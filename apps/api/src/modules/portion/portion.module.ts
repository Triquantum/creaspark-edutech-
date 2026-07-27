import {
  Body, Controller, ForbiddenException, Get, Headers, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UnauthorizedException, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

// ── DTOs ──
export class CreatePortionReportDto {
  @IsString() subjectId: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsIn(["DAILY", "WEEKLY"]) period: "DAILY" | "WEEKLY";
  @IsDateString() periodDate: string;
  @IsString() chapterName: string;
  @IsOptional() @IsString() description?: string;
  @IsString() topicsCovered: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) percentComplete?: number;
  @IsIn(["PRACTICAL", "THEORY"]) mode: "PRACTICAL" | "THEORY";
  @IsIn(["PENDING", "IN_PROGRESS", "COMPLETED"]) completionStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED";
}

export class QueryPortionReportsDto {
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(["SUBMITTED", "REVIEWED", "FLAGGED"]) status?: "SUBMITTED" | "REVIEWED" | "FLAGGED";
  @IsOptional() @IsIn(["PRACTICAL", "THEORY"]) mode?: "PRACTICAL" | "THEORY";
  @IsOptional() @IsIn(["PENDING", "IN_PROGRESS", "COMPLETED"]) completionStatus?: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() month?: string;
  @IsOptional() @IsString() year?: string;
}

export class ReviewPortionReportDto {
  @IsIn(["REVIEWED", "FLAGGED"]) status: "REVIEWED" | "FLAGGED";
  @IsOptional() @IsString() reviewNote?: string;
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsString() remarks?: string;
}

const REVIEW_ROLES = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR] as const;
const SUBMIT_ROLES = [Role.TEACHER, Role.TRAINER] as const;
// Priority order for who a school's automated reminder appears to come
// from — prefers whoever's most directly responsible for that teacher.
const REMINDER_SENDER_ROLES = [Role.SCHOOL_ADMIN, Role.ORG_ADMIN, Role.PRINCIPAL, Role.COORDINATOR] as const;

/**
 * Teacher-submitted daily/weekly syllabus-coverage entries. There's no
 * separate "report" document — the row itself, once reviewed, IS the
 * report: what was taught, when, and the admin's review note sit on the
 * same record so nothing can drift out of sync between submission and review.
 */
@Injectable()
export class PortionService {
  constructor(private prisma: PrismaService) {}

  /** A teacher's own school comes from their StaffProfile — they always
   * belong to exactly one, unlike SUPER_ADMIN who has none. */
  private async teacherSchool(userId: string): Promise<{ tenantId: string; schoolId: string }> {
    const profile = await this.prisma.staffProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException("No staff profile found for this account");
    return { tenantId: profile.tenantId, schoolId: profile.schoolId };
  }

  /** Read-only scope for the review/list side: cross-tenant for SUPER_ADMIN
   * when no schoolId filter is given, else the caller's own tenant. */
  private async readScope(user: AuthUser, schoolId?: string): Promise<{ tenantId?: string; schoolId?: string }> {
    if (user.role === Role.SUPER_ADMIN) return { schoolId };
    const { tenantId } = currentTenant();
    return { tenantId, schoolId };
  }

  async create(dto: CreatePortionReportDto, user: AuthUser) {
    const { tenantId, schoolId } = await this.teacherSchool(user.id);
    const report = await this.prisma.portionReport.create({
      data: {
        tenantId, schoolId, teacherId: user.id,
        subjectId: dto.subjectId, classId: dto.classId, sectionId: dto.sectionId,
        period: dto.period, periodDate: new Date(dto.periodDate),
        chapterName: dto.chapterName, description: dto.description,
        topicsCovered: dto.topicsCovered, percentComplete: dto.percentComplete,
        mode: dto.mode, completionStatus: dto.completionStatus,
      },
      include: { subject: { select: { name: true } }, teacher: { select: { fullName: true } } },
    });
    await this.notifyReviewers(tenantId, report);
    return report;
  }

  /** Every submission alerts this school's own reviewers (Org/School Admin,
   * Principal, VP, Coordinator) plus every Super Admin platform-wide, via
   * the existing Message/bell system rather than a separate notification
   * type — reuses read-tracking, inbox, and the bell's unread count as-is. */
  private async notifyReviewers(
    tenantId: string,
    report: { teacherId: string; period: string; chapterName: string | null; subject: { name: string }; teacher: { fullName: string } },
  ) {
    const tenantReviewerRoles = REVIEW_ROLES.filter((r) => r !== Role.SUPER_ADMIN);
    const [tenantReviewers, superAdmins] = await Promise.all([
      this.prisma.user.findMany({ where: { tenantId, role: { in: tenantReviewerRoles }, isActive: true }, select: { id: true } }),
      this.prisma.user.findMany({ where: { role: Role.SUPER_ADMIN, isActive: true }, select: { id: true } }),
    ]);
    const recipients = [...tenantReviewers, ...superAdmins];
    if (!recipients.length) return;

    const chapterSuffix = report.chapterName ? ` — ${report.chapterName}` : "";
    await this.prisma.message.createMany({
      data: recipients.map((r) => ({
        tenantId, senderId: report.teacherId, recipientId: r.id,
        subject: "Portion status submitted",
        body: `${report.teacher.fullName} submitted a ${report.period === "DAILY" ? "daily" : "weekly"} portion update for ${report.subject.name}${chapterSuffix}.`,
      })),
    });
  }

  /** `from`/`to` win when given; otherwise a month (optionally + year) or a
   * bare year narrows the range — the exact UTC calendar range Prisma needs. */
  private periodDateFilter(query: QueryPortionReportsDto): { periodDate?: { gte?: Date; lte?: Date; lt?: Date } } {
    if (query.from || query.to) {
      return { periodDate: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } };
    }
    if (!query.month && !query.year) return {};
    const now = new Date();
    const year = query.year ? Number(query.year) : now.getUTCFullYear();
    if (query.month) {
      const monthIndex = Number(query.month) - 1;
      return { periodDate: { gte: new Date(Date.UTC(year, monthIndex, 1)), lt: new Date(Date.UTC(year, monthIndex + 1, 1)) } };
    }
    return { periodDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } };
  }

  private textSearchFilter(q?: string) {
    if (!q) return {};
    return {
      OR: [
        { chapterName: { contains: q, mode: "insensitive" as const } },
        { topicsCovered: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ],
    };
  }

  async listMine(user: AuthUser, query: QueryPortionReportsDto) {
    return this.prisma.portionReport.findMany({
      where: {
        tenantId: currentTenant().tenantId, teacherId: user.id,
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.classId && { classId: query.classId }),
        ...(query.completionStatus && { completionStatus: query.completionStatus }),
        ...(query.mode && { mode: query.mode }),
        ...this.textSearchFilter(query.q),
        ...this.periodDateFilter(query),
      },
      include: { subject: { select: { name: true } }, class: { select: { name: true } }, section: { select: { name: true } } },
      orderBy: { periodDate: "desc" },
      take: 60,
    });
  }

  async list(user: AuthUser, query: QueryPortionReportsDto) {
    const scope = await this.readScope(user, query.schoolId);
    return this.prisma.portionReport.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        ...(scope.schoolId && { schoolId: scope.schoolId }),
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.classId && { classId: query.classId }),
        ...(query.status && { status: query.status }),
        ...(query.mode && { mode: query.mode }),
        ...(query.completionStatus && { completionStatus: query.completionStatus }),
        ...this.textSearchFilter(query.q),
        ...this.periodDateFilter(query),
      },
      include: {
        teacher: { select: { fullName: true, email: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
        school: { select: { name: true } },
        reviewer: { select: { fullName: true } },
      },
      orderBy: { periodDate: "desc" },
      take: 200,
    });
  }

  async review(id: string, dto: ReviewPortionReportDto, user: AuthUser) {
    const existing = await this.prisma.portionReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Portion report not found");
    if (user.role !== Role.SUPER_ADMIN && existing.tenantId !== currentTenant().tenantId) {
      throw new NotFoundException("Portion report not found");
    }
    return this.prisma.portionReport.update({
      where: { id },
      data: {
        status: dto.status, reviewNote: dto.reviewNote,
        reviewComments: dto.comments, reviewRemarks: dto.remarks,
        reviewedBy: user.id, reviewedAt: new Date(),
      },
    });
  }

  /** Monday 00:00:00 UTC through the following Monday (exclusive) — the
   * week this reminder run is checking submissions for. */
  private currentWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const daysSinceMonday = (now.getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }

  private async findReminderSender(tenantId: string): Promise<string | null> {
    for (const role of REMINDER_SENDER_ROLES) {
      const u = await this.prisma.user.findFirst({ where: { tenantId, role, isActive: true }, select: { id: true } });
      if (u) return u.id;
    }
    return null;
  }

  /** Weekly cron target: every active teacher with no portion submission
   * (daily or weekly) yet this week gets a reminder message. Attributed to
   * a reviewer in their own school rather than a system account, since
   * Message has no concept of a senderless/system message; a tenant with
   * no reviewer on staff is skipped rather than left unattributed. */
  async remindMissingSubmissions() {
    const { start, end } = this.currentWeekRange();
    const teachers = await this.prisma.user.findMany({
      where: { role: Role.TEACHER, isActive: true },
      select: { id: true, tenantId: true, fullName: true },
    });
    if (!teachers.length) return { reminded: 0 };

    const submitted = await this.prisma.portionReport.findMany({
      where: { teacherId: { in: teachers.map((t) => t.id) }, periodDate: { gte: start, lt: end } },
      select: { teacherId: true },
      distinct: ["teacherId"],
    });
    const submittedIds = new Set(submitted.map((s) => s.teacherId));
    const missing = teachers.filter((t) => !submittedIds.has(t.id));
    if (!missing.length) return { reminded: 0 };

    const tenantIds = [...new Set(missing.map((t) => t.tenantId))];
    const senderByTenant = new Map<string, string>();
    for (const tenantId of tenantIds) {
      const senderId = await this.findReminderSender(tenantId);
      if (senderId) senderByTenant.set(tenantId, senderId);
    }

    const remindable = missing.filter((t) => senderByTenant.has(t.tenantId));
    if (!remindable.length) return { reminded: 0 };

    await this.prisma.message.createMany({
      data: remindable.map((t) => ({
        tenantId: t.tenantId,
        senderId: senderByTenant.get(t.tenantId)!,
        recipientId: t.id,
        subject: "Portion status reminder",
        body: `Hi ${t.fullName}, you haven't submitted a portion status update this week yet. Please submit one from the Portion Tracker.`,
      })),
    });
    return { reminded: remindable.length };
  }
}

@ApiTags("portion")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("portion")
export class PortionController {
  constructor(private svc: PortionService) {}

  @Post()
  @Roles(...SUBMIT_ROLES)
  create(@Body() dto: CreatePortionReportDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Get("mine")
  @Roles(...SUBMIT_ROLES)
  mine(@Query() query: QueryPortionReportsDto, @CurrentUser() user: AuthUser) {
    return this.svc.listMine(user, query);
  }

  @Get()
  @Roles(...REVIEW_ROLES)
  list(@Query() query: QueryPortionReportsDto, @CurrentUser() user: AuthUser) {
    return this.svc.list(user, query);
  }

  @Patch(":id/review")
  @Roles(...REVIEW_ROLES)
  review(@Param("id") id: string, @Body() dto: ReviewPortionReportDto, @CurrentUser() user: AuthUser) {
    return this.svc.review(id, dto, user);
  }
}

/** No JwtAuthGuard here — Vercel's cron invocation carries no user session,
 * only the `Authorization: Bearer $CRON_SECRET` header Vercel adds
 * automatically once CRON_SECRET is set as an env var. Guarded manually
 * instead so a stray/missing secret fails closed rather than open. */
@Controller("portion/cron")
export class PortionCronController {
  constructor(private svc: PortionService) {}

  @Get("remind-missing")
  remindMissing(@Headers("authorization") auth?: string) {
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new UnauthorizedException();
    }
    return this.svc.remindMissingSubmissions();
  }
}

@Module({ controllers: [PortionController, PortionCronController], providers: [PortionService] })
export class PortionModule {}
