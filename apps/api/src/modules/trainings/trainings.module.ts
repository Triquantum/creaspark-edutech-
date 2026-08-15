import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Res, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma, Role } from "@educore/database";
import type { Response } from "express";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  CreateTrainingDto, EmailTrainingReportDto, MarkAttendanceDto, SubmitFeedbackDto,
  UpdateTrainingDto, UpdateTrainingStatusDto,
} from "./trainings.dto";

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

  private async isTargeted(
    training: { targetRoles: Role[]; targetSchoolId: string | null; targetClassIds: string[] },
    user: AuthUser,
  ): Promise<boolean> {
    const roleOk = training.targetRoles.length === 0 || training.targetRoles.includes(user.role as Role);
    if (!roleOk) return false;
    if (training.targetSchoolId && (await this.resolveMySchoolId(user.id)) !== training.targetSchoolId) return false;
    if (training.targetClassIds.length > 0 && user.role === Role.TEACHER) {
      const assigned = await this.prisma.teacherAssignment.findFirst({
        where: { teacherId: user.id, section: { classId: { in: training.targetClassIds } } },
      });
      if (!assigned) return false;
    }
    return true;
  }

  /** Same audience match used to decide who gets notified -- reused here so
   * the attendance picker lists exactly the people who were targeted.
   * targetClassIds narrows teachers to those with a TeacherAssignment on one
   * of those classes (via their section); non-teacher roles are unaffected. */
  private audienceWhere(targetRoles: Role[], targetSchoolId: string | null, targetClassIds: string[]): Prisma.UserWhereInput {
    const AND: Prisma.UserWhereInput[] = [{ isActive: true }];
    if (targetRoles.length > 0) AND.push({ role: { in: targetRoles } });
    if (targetSchoolId) AND.push({ staffProfile: { schoolId: targetSchoolId } });
    if (targetClassIds.length > 0) {
      AND.push({
        OR: [
          { role: { not: Role.TEACHER } },
          { teacherAssignments: { some: { section: { classId: { in: targetClassIds } } } } },
        ],
      });
    }
    return { AND };
  }

  /** Notifies the matched audience via the existing Message/bell system --
   * same reuse as portion.module.ts's notifyReviewers and tasks.module.ts's
   * notifyAssignee. Each recipient's message is stamped with THEIR OWN
   * tenantId (not the creating Super Admin's placeholder one) since a
   * platform-wide training's audience can span every tenant, and a
   * Message only surfaces in a recipient's own tenant-scoped inbox. */
  private async notifyAudience(
    training: { id: string; title: string }, creatorId: string,
    targetRoles: Role[], targetSchoolId: string | undefined, targetClassIds: string[],
  ) {
    const recipients = await this.prisma.user.findMany({
      where: this.audienceWhere(targetRoles, targetSchoolId ?? null, targetClassIds),
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
    const targetClassIds = dto.targetClassIds ?? [];
    const training = await this.prisma.training.create({
      data: {
        tenantId: currentTenant().tenantId, title: dto.title, description: dto.description,
        subject: dto.subject, venue: dto.venue, duration: dto.duration,
        resourcePerson: dto.resourcePerson, agenda: dto.agenda,
        ...(dto.status && { status: dto.status }),
        conductedAt: new Date(dto.conductedAt), conductedById: user.id,
        targetRoles, targetSchoolId: dto.targetSchoolId, targetClassIds,
      },
      include: TRAINING_INCLUDE,
    });
    await this.notifyAudience(training, user.id, targetRoles, dto.targetSchoolId, targetClassIds);
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
    const conditions: Prisma.TrainingWhereInput[] = [
      { OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: user.role as Role } }] },
      { OR: [{ targetSchoolId: null }, ...(mySchoolId ? [{ targetSchoolId: mySchoolId }] : [])] },
    ];
    if (user.role === Role.TEACHER) {
      const assignments = await this.prisma.teacherAssignment.findMany({
        where: { teacherId: user.id }, select: { section: { select: { classId: true } } },
      });
      const myClassIds = [...new Set(assignments.map((a) => a.section.classId))];
      conditions.push({ OR: [{ targetClassIds: { isEmpty: true } }, { targetClassIds: { hasSome: myClassIds } }] });
    }
    return this.prisma.training.findMany({
      where: { AND: conditions },
      include: {
        ...TRAINING_INCLUDE,
        feedback: { where: { respondentId: user.id }, select: { id: true } },
        attendance: { where: { userId: user.id }, select: { present: true } },
      },
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

  /** SUPER_ADMIN-only: full edit. Optional text fields sent as "" clear the
   * stored value to null; omitted fields are left untouched. */
  async update(id: string, dto: UpdateTrainingDto) {
    await this.findTraining(id);
    const clearable = (v: string | undefined) => (v === undefined ? undefined : v || null);
    return this.prisma.training.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        description: clearable(dto.description),
        subject: clearable(dto.subject),
        venue: clearable(dto.venue),
        duration: clearable(dto.duration),
        resourcePerson: clearable(dto.resourcePerson),
        agenda: clearable(dto.agenda),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.conductedAt !== undefined && { conductedAt: new Date(dto.conductedAt) }),
        ...(dto.targetRoles !== undefined && { targetRoles: dto.targetRoles }),
        targetSchoolId: clearable(dto.targetSchoolId),
        ...(dto.targetClassIds !== undefined && { targetClassIds: dto.targetClassIds }),
      },
      include: TRAINING_INCLUDE,
    });
  }

  /** SUPER_ADMIN-only: delete a training. Cascades to its attendance and feedback rows. */
  async remove(id: string) {
    await this.findTraining(id);
    await this.prisma.training.delete({ where: { id } });
    return { deleted: true };
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
      where: this.audienceWhere(training.targetRoles, training.targetSchoolId, training.targetClassIds),
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

  /** Single-training report: details, feedback summary + responses, and
   * the attendance roster -- pdfkit has no table primitive for the
   * detail/feedback sections, so they're laid out as plain text lines;
   * only the attendance roster is dense enough to warrant a grid. */
  private buildTrainingReportPdf(
    training: Awaited<ReturnType<TrainingsService["findTraining"]>> & {
      conductedBy: { fullName: string }; targetSchool: { name: string } | null;
    },
    feedback: Awaited<ReturnType<TrainingsService["getFeedback"]>>,
    attendance: Awaited<ReturnType<TrainingsService["getAttendance"]>>,
    classNames: string[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).fillColor("#000").text(training.title);
      doc.fontSize(9).fillColor("#666").text(`Generated ${new Date().toLocaleString("en-IN")}`);
      doc.moveDown();

      const audience = [
        training.targetRoles.length === 0 ? "Everyone" : training.targetRoles.join(", "),
        training.targetSchool?.name,
        classNames.length > 0 ? classNames.join(", ") : null,
      ].filter(Boolean).join(" · ");

      doc.fontSize(12).fillColor("#000").text("Details", { underline: true });
      doc.fontSize(10).fillColor("#333");
      const details: [string, string][] = [
        ["Subject", training.subject ?? "—"],
        ["Status", training.status],
        ["Conducted on", new Date(training.conductedAt).toLocaleDateString("en-IN")],
        ["Conducted by", training.conductedBy.fullName],
        ["Venue", training.venue ?? "—"],
        ["Duration", training.duration ?? "—"],
        ["Resource person", training.resourcePerson ?? "—"],
        ["Audience", audience || "Everyone"],
      ];
      for (const [label, value] of details) doc.text(`${label}: ${value}`);
      if (training.description) doc.moveDown(0.3).text(`Description: ${training.description}`);
      if (training.agenda) doc.moveDown(0.3).text(`Agenda: ${training.agenda}`);

      doc.moveDown();
      doc.fontSize(12).fillColor("#000").text("Feedback summary", { underline: true });
      doc.fontSize(10).fillColor("#333").text(
        `Content: ${feedback.averages.content ?? "—"}   Trainer: ${feedback.averages.trainer ?? "—"}   `
        + `Usefulness: ${feedback.averages.usefulness ?? "—"}   Overall: ${feedback.averages.overall ?? "—"}`,
      );
      doc.moveDown(0.3);
      if (feedback.responses.length === 0) {
        doc.text("No feedback submitted yet.");
      } else {
        for (const r of feedback.responses) {
          doc.text(
            `${r.respondent.fullName} (${r.respondent.role}) — Content ${r.contentRating}, `
            + `Trainer ${r.trainerRating}, Usefulness ${r.usefulnessRating}, Overall ${r.overallRating}`,
          );
          if (r.comments) doc.fontSize(9).fillColor("#666").text(r.comments, { indent: 12 }).fontSize(10).fillColor("#333");
        }
      }

      doc.moveDown();
      doc.fontSize(12).fillColor("#000").text("Attendance", { underline: true });
      doc.fontSize(10).fillColor("#333");
      if (attendance.length === 0) {
        doc.text("No one is targeted by this training yet.");
      } else {
        for (const a of attendance) {
          const mark = a.present === true ? "Present" : a.present === false ? "Absent" : "Not marked";
          doc.text(`${a.fullName} (${a.role}${a.schoolName ? ` · ${a.schoolName}` : ""}) — ${mark}`);
        }
      }

      doc.end();
    });
  }

  /** Fails fast with a clear message rather than a cryptic SMTP error if
   * the server has no email credentials configured yet. */
  private async sendEmail(to: string, subject: string, text: string, attachment: { filename: string; content: Buffer }): Promise<void> {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new BadRequestException(
        "Email sending isn't configured on this server yet — an administrator needs to set SMTP_HOST/SMTP_USER/SMTP_PASS.",
      );
    }
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    try {
      await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text, attachments: [attachment] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SMTP error";
      throw new BadRequestException(`Could not send email: ${message}`);
    }
  }

  async reportPdf(id: string): Promise<Buffer> {
    const training = await this.prisma.training.findUnique({ where: { id }, include: TRAINING_INCLUDE });
    if (!training) throw new NotFoundException("Training not found");
    const [feedback, attendance, classes] = await Promise.all([
      this.getFeedback(id),
      this.getAttendance(id),
      training.targetClassIds.length
        ? this.prisma.class.findMany({ where: { id: { in: training.targetClassIds } }, select: { name: true } })
        : Promise.resolve([]),
    ]);
    return this.buildTrainingReportPdf(training, feedback, attendance, classes.map((c) => c.name));
  }

  async emailReport(id: string, toEmail: string): Promise<{ sent: boolean }> {
    const training = await this.findTraining(id);
    const pdf = await this.reportPdf(id);
    await this.sendEmail(
      toEmail,
      `Training Report — ${training.title}`,
      `Attached is the training report for "${training.title}", generated ${new Date().toLocaleString("en-IN")}.`,
      { filename: "training-report.pdf", content: pdf },
    );
    return { sent: true };
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

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateTrainingDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN)
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
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

  /** "Print" is just opening this PDF in a new tab and using the browser's own print dialog. */
  @Get(":id/report/pdf")
  @Roles(Role.SUPER_ADMIN)
  async reportPdf(@Param("id") id: string, @Res() res: Response) {
    const pdf = await this.svc.reportPdf(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="training-report.pdf"');
    res.send(pdf);
  }

  @Post(":id/report/email")
  @Roles(Role.SUPER_ADMIN)
  emailReport(@Param("id") id: string, @Body() dto: EmailTrainingReportDto) {
    return this.svc.emailReport(id, dto.toEmail);
  }
}

@Module({ controllers: [TrainingsController], providers: [TrainingsService] })
export class TrainingsModule {}
