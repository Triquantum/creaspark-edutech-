import {
  Body, Controller, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { CreateTrainingDto, MarkAttendanceDto, SubmitFeedbackDto, UpdateTrainingStatusDto } from "./trainings.dto";

const TRAINING_INCLUDE = {
  conductedBy: { select: { fullName: true } },
  targetSchool: { select: { name: true } },
};

@Injectable()
export class TrainingsService {
  constructor(private prisma: PrismaService) {}

  /** A user's own school, resolved the same way messages.module.ts's
   * personFilter() does -- staff via StaffProfile, students directly,
   * parents via their first linked student. Returns null if none (e.g. an
   * admin role with no school of their own), which excludes them from any
   * school-restricted training while still matching platform-wide ones. */
  private async resolveMySchoolId(userId: string): Promise<string | null> {
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId }, select: { schoolId: true } });
    if (staff) return staff.schoolId;
    const student = await this.prisma.student.findFirst({ where: { userId }, select: { schoolId: true } });
    if (student) return student.schoolId;
    const guardian = await this.prisma.guardian.findFirst({ where: { userId }, select: { student: { select: { schoolId: true } } } });
    return guardian?.student.schoolId ?? null;
  }

  private async isTargeted(training: { targetRoles: Role[]; targetSchoolId: string | null }, user: AuthUser): Promise<boolean> {
    const roleOk = training.targetRoles.length === 0 || training.targetRoles.includes(user.role as Role);
    if (!roleOk) return false;
    if (!training.targetSchoolId) return true;
    return (await this.resolveMySchoolId(user.id)) === training.targetSchoolId;
  }

  /** Same audience match used to decide who gets notified -- reused here so
   * the attendance picker lists exactly the people who were targeted. */
  private audienceWhere(targetRoles: Role[], targetSchoolId: string | null) {
    return {
      isActive: true,
      ...(targetRoles.length > 0 && { role: { in: targetRoles } }),
      ...(targetSchoolId && { staffProfile: { schoolId: targetSchoolId } }),
    };
  }

  /** Notifies the matched audience via the existing Message/bell system --
   * same reuse as portion.module.ts's notifyReviewers and tasks.module.ts's
   * notifyAssignee. Each recipient's message is stamped with THEIR OWN
   * tenantId (not the creating Super Admin's placeholder one) since a
   * platform-wide training's audience can span every tenant, and a
   * Message only surfaces in a recipient's own tenant-scoped inbox. */
  private async notifyAudience(training: { id: string; title: string }, creatorId: string, targetRoles: Role[], targetSchoolId?: string) {
    const recipients = await this.prisma.user.findMany({
      where: this.audienceWhere(targetRoles, targetSchoolId ?? null),
      select: { id: true, tenantId: true },
    });
    if (!recipients.length) return;
    await this.prisma.message.createMany({
      data: recipients.map((r) => ({
        tenantId: r.tenantId, senderId: creatorId, recipientId: r.id,
        subject: "New training scheduled",
        body: `"${training.title}" has been scheduled. Please share your feedback once it's complete.`,
      })),
    });
  }

  async create(dto: CreateTrainingDto, user: AuthUser) {
    const targetRoles = dto.targetRoles ?? [];
    const training = await this.prisma.training.create({
      data: {
        tenantId: currentTenant().tenantId, title: dto.title, description: dto.description,
        subject: dto.subject, venue: dto.venue, duration: dto.duration,
        resourcePerson: dto.resourcePerson, agenda: dto.agenda,
        ...(dto.status && { status: dto.status }),
        conductedAt: new Date(dto.conductedAt), conductedById: user.id,
        targetRoles, targetSchoolId: dto.targetSchoolId,
      },
      include: TRAINING_INCLUDE,
    });
    await this.notifyAudience(training, user.id, targetRoles, dto.targetSchoolId);
    return training;
  }

  /** SUPER_ADMIN sees every training with a response count; everyone else
   * sees only trainings targeted at their role + school, each flagged with
   * whether they've already submitted feedback. */
  async list(user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.training.findMany({
        include: { ...TRAINING_INCLUDE, _count: { select: { feedback: true } } },
        orderBy: { conductedAt: "desc" },
      });
    }
    const mySchoolId = await this.resolveMySchoolId(user.id);
    return this.prisma.training.findMany({
      where: {
        AND: [
          { OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: user.role as Role } }] },
          { OR: [{ targetSchoolId: null }, ...(mySchoolId ? [{ targetSchoolId: mySchoolId }] : [])] },
        ],
      },
      include: { ...TRAINING_INCLUDE, feedback: { where: { respondentId: user.id }, select: { id: true } } },
      orderBy: { conductedAt: "desc" },
    });
  }

  private async findTraining(id: string) {
    const training = await this.prisma.training.findUnique({ where: { id } });
    if (!training) throw new NotFoundException("Training not found");
    return training;
  }

  /** SUPER_ADMIN-only: move a training through its Scheduled/Ongoing/Completed/Cancelled lifecycle. */
  async updateStatus(id: string, dto: UpdateTrainingStatusDto) {
    await this.findTraining(id);
    return this.prisma.training.update({
      where: { id }, data: { status: dto.status }, include: TRAINING_INCLUDE,
    });
  }

  /** SUPER_ADMIN-only: every response plus rating averages. */
  async getFeedback(id: string) {
    await this.findTraining(id);
    const responses = await this.prisma.trainingFeedback.findMany({
      where: { trainingId: id },
      include: { respondent: { select: { fullName: true, role: true } } },
      orderBy: { submittedAt: "desc" },
    });
    const avg = (key: "contentRating" | "trainerRating" | "usefulnessRating" | "overallRating") =>
      responses.length ? Math.round((responses.reduce((s, r) => s + r[key], 0) / responses.length) * 10) / 10 : null;
    return {
      responses,
      averages: {
        content: avg("contentRating"), trainer: avg("trainerRating"),
        usefulness: avg("usefulnessRating"), overall: avg("overallRating"),
      },
    };
  }

  async myFeedback(id: string, user: AuthUser) {
    return this.prisma.trainingFeedback.findUnique({
      where: { trainingId_respondentId: { trainingId: id, respondentId: user.id } },
    });
  }

  async submitFeedback(id: string, dto: SubmitFeedbackDto, user: AuthUser) {
    const training = await this.findTraining(id);
    if (!(await this.isTargeted(training, user))) throw new NotFoundException("Training not found");
    return this.prisma.trainingFeedback.upsert({
      where: { trainingId_respondentId: { trainingId: id, respondentId: user.id } },
      create: {
        tenantId: currentTenant().tenantId, trainingId: id, respondentId: user.id,
        contentRating: dto.contentRating, trainerRating: dto.trainerRating,
        usefulnessRating: dto.usefulnessRating, overallRating: dto.overallRating, comments: dto.comments,
      },
      update: {
        contentRating: dto.contentRating, trainerRating: dto.trainerRating,
        usefulnessRating: dto.usefulnessRating, overallRating: dto.overallRating, comments: dto.comments,
        submittedAt: new Date(),
      },
    });
  }

  /** SUPER_ADMIN-only: the targeted audience, each row carrying their
   * existing attendance mark (if any) so the picker opens pre-checked. */
  async getAttendance(id: string) {
    const training = await this.findTraining(id);
    const audience = await this.prisma.user.findMany({
      where: this.audienceWhere(training.targetRoles, training.targetSchoolId),
      select: {
        id: true, fullName: true, role: true,
        staffProfile: { select: { school: { select: { name: true } } } },
      },
      orderBy: { fullName: "asc" },
    });
    const records = await this.prisma.trainingAttendance.findMany({ where: { trainingId: id } });
    const byUser = new Map(records.map((r) => [r.userId, r]));
    return audience.map((u) => ({
      userId: u.id, fullName: u.fullName, role: u.role, schoolName: u.staffProfile?.school.name ?? null,
      present: byUser.get(u.id)?.present ?? null,
      markedAt: byUser.get(u.id)?.markedAt ?? null,
    }));
  }

  /** SUPER_ADMIN-only: bulk upsert Present/Absent marks for the audience. */
  async markAttendance(id: string, dto: MarkAttendanceDto, user: AuthUser) {
    await this.findTraining(id);
    const tenantId = currentTenant().tenantId;
    await this.prisma.$transaction(
      dto.records.map((r) =>
        this.prisma.trainingAttendance.upsert({
          where: { trainingId_userId: { trainingId: id, userId: r.userId } },
          create: { tenantId, trainingId: id, userId: r.userId, present: r.present, markedById: user.id },
          update: { present: r.present, markedById: user.id, markedAt: new Date() },
        }),
      ),
    );
    return this.getAttendance(id);
  }
}

@ApiTags("trainings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("trainings")
export class TrainingsController {
  constructor(private svc: TrainingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateTrainingDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Patch(":id/status")
  @Roles(Role.SUPER_ADMIN)
  updateStatus(@Param("id") id: string, @Body() dto: UpdateTrainingStatusDto) {
    return this.svc.updateStatus(id, dto);
  }

  @Get(":id/feedback")
  @Roles(Role.SUPER_ADMIN)
  getFeedback(@Param("id") id: string) {
    return this.svc.getFeedback(id);
  }

  @Get(":id/my-feedback")
  myFeedback(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.myFeedback(id, user);
  }

  @Post(":id/feedback")
  submitFeedback(@Param("id") id: string, @Body() dto: SubmitFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.svc.submitFeedback(id, dto, user);
  }

  @Get(":id/attendance")
  @Roles(Role.SUPER_ADMIN)
  getAttendance(@Param("id") id: string) {
    return this.svc.getAttendance(id);
  }

  @Post(":id/attendance")
  @Roles(Role.SUPER_ADMIN)
  markAttendance(@Param("id") id: string, @Body() dto: MarkAttendanceDto, @CurrentUser() user: AuthUser) {
    return this.svc.markAttendance(id, dto, user);
  }
}

@Module({ controllers: [TrainingsController], providers: [TrainingsService] })
export class TrainingsModule {}
