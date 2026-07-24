import {
  Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UseGuards,
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
  @IsString() topicsCovered: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) percentComplete?: number;
}

export class QueryPortionReportsDto {
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsIn(["SUBMITTED", "REVIEWED", "FLAGGED"]) status?: "SUBMITTED" | "REVIEWED" | "FLAGGED";
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class ReviewPortionReportDto {
  @IsIn(["REVIEWED", "FLAGGED"]) status: "REVIEWED" | "FLAGGED";
  @IsOptional() @IsString() reviewNote?: string;
}

const REVIEW_ROLES = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR] as const;
const SUBMIT_ROLES = [Role.TEACHER, Role.TRAINER] as const;

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
        topicsCovered: dto.topicsCovered, percentComplete: dto.percentComplete,
      },
    });
    return report;
  }

  async listMine(user: AuthUser) {
    return this.prisma.portionReport.findMany({
      where: { tenantId: currentTenant().tenantId, teacherId: user.id },
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
        ...(query.status && { status: query.status }),
        ...((query.from || query.to) && {
          periodDate: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) },
        }),
      },
      include: {
        teacher: { select: { fullName: true, email: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
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
      data: { status: dto.status, reviewNote: dto.reviewNote, reviewedBy: user.id, reviewedAt: new Date() },
    });
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
  mine(@CurrentUser() user: AuthUser) {
    return this.svc.listMine(user);
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

@Module({ controllers: [PortionController], providers: [PortionService] })
export class PortionModule {}
