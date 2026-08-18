import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module,
  NotFoundException, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LeaveApplicationStatus, Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  AssignLeaveBalanceDto, CreateLeaveApplicationDto, CreateLeaveTypeDto,
  ReviewLeaveApplicationDto, UpdateLeaveTypeDto,
} from "./leave.dto";

// Everyone who could plausibly take staff leave -- every role except the
// three that aren't staff (Parent/Student/Guest).
const STAFF_ROLES = [
  Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR,
  Role.ACADEMIC_ADMIN, Role.FINANCE_HR_ADMIN, Role.TEACHER, Role.TRAINER, Role.ACCOUNTANT, Role.RECEPTION,
  Role.LIBRARIAN, Role.TRANSPORT_MANAGER, Role.HR, Role.INVENTORY_MANAGER, Role.HOSTEL_WARDEN, Role.SECURITY,
  Role.SALES_EXECUTIVE, Role.SALES_MANAGER,
] as const;

// Mirrors nav-config.ts's SCHOOL_MANAGEMENT constant used for Leave
// Category/Leave Assign, plus FINANCE_HR_ADMIN -- the same addition the HR
// nav group makes on top of SCHOOL_MANAGEMENT, since assigning leave
// balances is an HR-admin function.
const LEAVE_ADMIN_ROLES = [
  Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR,
  Role.HR, Role.FINANCE_HR_ADMIN,
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  /** Same pattern as trainings.module.ts's resolveMySchoolId -- staff via
   * StaffProfile. Admin roles reviewing/assigning leave are themselves
   * staff at one school, so this scopes their reads/writes to that school
   * rather than leaking data tenant-wide the way the old GenericRecord
   * catch-all did. Returns null for SUPER_ADMIN/ORG_ADMIN, who see the
   * whole tenant. */
  private async resolveMySchoolId(userId: string): Promise<string | null> {
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId }, select: { schoolId: true } });
    return staff?.schoolId ?? null;
  }

  private isCrossSchoolAdmin(role: string): boolean {
    return role === Role.SUPER_ADMIN || role === Role.ORG_ADMIN;
  }

  // ── Leave Types ──

  listTypes() {
    const tenantId = currentTenant().tenantId;
    return this.prisma.leaveType.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  async createType(dto: CreateLeaveTypeDto) {
    const tenantId = currentTenant().tenantId;
    return this.prisma.leaveType.create({ data: { tenantId, name: dto.name, daysPerYear: dto.daysPerYear } });
  }

  async updateType(id: string, dto: UpdateLeaveTypeDto) {
    await this.findType(id);
    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }

  async removeType(id: string) {
    await this.findType(id);
    const [balances, applications] = await Promise.all([
      this.prisma.leaveBalance.count({ where: { leaveTypeId: id } }),
      this.prisma.leaveApplication.count({ where: { leaveTypeId: id } }),
    ]);
    if (balances > 0 || applications > 0) {
      throw new BadRequestException("This leave type has assigned balances or applications and can't be deleted");
    }
    await this.prisma.leaveType.delete({ where: { id } });
    return { deleted: true };
  }

  private async findType(id: string) {
    const tenantId = currentTenant().tenantId;
    const type = await this.prisma.leaveType.findFirst({ where: { id, tenantId } });
    if (!type) throw new NotFoundException("Leave type not found");
    return type;
  }

  // ── Leave Balances ──

  myBalances(user: AuthUser) {
    return this.prisma.leaveBalance.findMany({
      where: { userId: user.id },
      include: { leaveType: true },
      orderBy: [{ year: "desc" }, { leaveType: { name: "asc" } }],
    });
  }

  async listBalances(query: { userId?: string; year?: string }, user: AuthUser) {
    const tenantId = currentTenant().tenantId;
    const schoolId = this.isCrossSchoolAdmin(user.role) ? undefined : await this.resolveMySchoolId(user.id);
    return this.prisma.leaveBalance.findMany({
      where: {
        tenantId,
        ...(query.userId && { userId: query.userId }),
        ...(query.year && { year: Number(query.year) }),
        ...(schoolId && { user: { staffProfile: { schoolId } } }),
      },
      include: { leaveType: true, user: { select: { fullName: true, role: true } } },
      orderBy: [{ year: "desc" }, { user: { fullName: "asc" } }],
    });
  }

  async assignBalance(dto: AssignLeaveBalanceDto, user: AuthUser) {
    const tenantId = currentTenant().tenantId;
    const target = await this.prisma.user.findFirst({ where: { id: dto.userId, tenantId } });
    if (!target) throw new NotFoundException("Staff member not found");
    return this.prisma.leaveBalance.upsert({
      where: { userId_leaveTypeId_year: { userId: dto.userId, leaveTypeId: dto.leaveTypeId, year: dto.year } },
      create: { tenantId, userId: dto.userId, leaveTypeId: dto.leaveTypeId, year: dto.year, allotted: dto.allotted, assignedById: user.id },
      update: { allotted: dto.allotted, assignedById: user.id },
    });
  }

  /** Staff picker for the Leave Assign screen. Deliberately self-contained
   * rather than reusing GET /employees, whose HR_ROLES gate excludes
   * PRINCIPAL/VICE_PRINCIPAL/COORDINATOR -- LEAVE_ADMIN_ROLES intentionally
   * includes them (matching nav-config.ts's SCHOOL_MANAGEMENT), and depending
   * on the stricter list would silently break the picker for those roles. */
  async listStaff(schoolId: string) {
    const tenantId = currentTenant().tenantId;
    const profiles = await this.prisma.staffProfile.findMany({
      where: { tenantId, schoolId },
      include: { user: { select: { id: true, fullName: true, role: true } } },
      orderBy: { user: { fullName: "asc" } },
    });
    return profiles.map((p) => p.user);
  }

  async removeBalance(id: string) {
    const tenantId = currentTenant().tenantId;
    const balance = await this.prisma.leaveBalance.findFirst({ where: { id, tenantId } });
    if (!balance) throw new NotFoundException("Leave balance not found");
    await this.prisma.leaveBalance.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Leave Applications ──

  myApplications(user: AuthUser) {
    return this.prisma.leaveApplication.findMany({
      where: { applicantId: user.id },
      include: { leaveType: true, reviewedBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listForReview(query: { status?: string }, user: AuthUser) {
    const tenantId = currentTenant().tenantId;
    const schoolId = this.isCrossSchoolAdmin(user.role) ? undefined : await this.resolveMySchoolId(user.id);
    return this.prisma.leaveApplication.findMany({
      where: {
        tenantId,
        ...(schoolId && { schoolId }),
        ...(query.status && { status: query.status as LeaveApplicationStatus }),
      },
      include: { leaveType: true, applicant: { select: { fullName: true, role: true } }, reviewedBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateLeaveApplicationDto, user: AuthUser) {
    const tenantId = currentTenant().tenantId;
    const type = await this.prisma.leaveType.findFirst({ where: { id: dto.leaveTypeId, tenantId } });
    if (!type) throw new NotFoundException("Leave type not found");

    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    if (toDate < fromDate) throw new BadRequestException("To date must be on or after from date");
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY) + 1;

    const schoolId = await this.resolveMySchoolId(user.id);
    return this.prisma.leaveApplication.create({
      data: { tenantId, schoolId, applicantId: user.id, leaveTypeId: dto.leaveTypeId, fromDate, toDate, days, reason: dto.reason },
      include: { leaveType: true },
    });
  }

  async review(id: string, dto: ReviewLeaveApplicationDto, user: AuthUser) {
    const application = await this.findApplicationInScope(id, user);
    if (application.status !== LeaveApplicationStatus.PENDING) {
      throw new BadRequestException("Only pending applications can be reviewed");
    }
    return this.prisma.leaveApplication.update({
      where: { id },
      data: {
        status: dto.status as LeaveApplicationStatus,
        reviewedById: user.id,
        reviewRemarks: dto.reviewRemarks,
        reviewedAt: new Date(),
      },
    });
  }

  /** Applicant may withdraw their own pending request; an admin in scope
   * may remove any application (e.g. entered in error). */
  async remove(id: string, user: AuthUser) {
    const tenantId = currentTenant().tenantId;
    const application = await this.prisma.leaveApplication.findFirst({ where: { id, tenantId } });
    if (!application) throw new NotFoundException("Leave application not found");
    const isOwner = application.applicantId === user.id;
    const isAdmin = (LEAVE_ADMIN_ROLES as readonly string[]).includes(user.role);
    if (!isOwner && !isAdmin) throw new ForbiddenException();
    if (isOwner && !isAdmin && application.status !== LeaveApplicationStatus.PENDING) {
      throw new BadRequestException("Only a pending application can be withdrawn");
    }
    await this.prisma.leaveApplication.delete({ where: { id } });
    return { deleted: true };
  }

  private async findApplicationInScope(id: string, user: AuthUser) {
    const tenantId = currentTenant().tenantId;
    const application = await this.prisma.leaveApplication.findFirst({ where: { id, tenantId } });
    if (!application) throw new NotFoundException("Leave application not found");
    if (!this.isCrossSchoolAdmin(user.role)) {
      const schoolId = await this.resolveMySchoolId(user.id);
      if (!schoolId || application.schoolId !== schoolId) throw new NotFoundException("Leave application not found");
    }
    return application;
  }
}

@ApiTags("leave")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("leave/types")
export class LeaveTypesController {
  constructor(private leave: LeaveService) {}

  @Get() @Roles(...STAFF_ROLES)
  list() { return this.leave.listTypes(); }

  @Post() @Roles(...LEAVE_ADMIN_ROLES)
  create(@Body() dto: CreateLeaveTypeDto) { return this.leave.createType(dto); }

  @Patch(":id") @Roles(...LEAVE_ADMIN_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateLeaveTypeDto) { return this.leave.updateType(id, dto); }

  @Delete(":id") @Roles(...LEAVE_ADMIN_ROLES)
  remove(@Param("id") id: string) { return this.leave.removeType(id); }
}

@ApiTags("leave")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("leave/balances")
export class LeaveBalancesController {
  constructor(private leave: LeaveService) {}

  @Get("mine") @Roles(...STAFF_ROLES)
  mine(@CurrentUser() user: AuthUser) { return this.leave.myBalances(user); }

  @Get() @Roles(...LEAVE_ADMIN_ROLES)
  list(@Query("userId") userId: string | undefined, @Query("year") year: string | undefined, @CurrentUser() user: AuthUser) {
    return this.leave.listBalances({ userId, year }, user);
  }

  @Get("staff") @Roles(...LEAVE_ADMIN_ROLES)
  staff(@Query("schoolId") schoolId: string) { return this.leave.listStaff(schoolId); }

  @Post() @Roles(...LEAVE_ADMIN_ROLES)
  assign(@Body() dto: AssignLeaveBalanceDto, @CurrentUser() user: AuthUser) { return this.leave.assignBalance(dto, user); }

  @Delete(":id") @Roles(...LEAVE_ADMIN_ROLES)
  remove(@Param("id") id: string) { return this.leave.removeBalance(id); }
}

@ApiTags("leave")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("leave/applications")
export class LeaveApplicationsController {
  constructor(private leave: LeaveService) {}

  @Get("mine") @Roles(...STAFF_ROLES)
  mine(@CurrentUser() user: AuthUser) { return this.leave.myApplications(user); }

  @Get() @Roles(...LEAVE_ADMIN_ROLES)
  list(@Query("status") status: string | undefined, @CurrentUser() user: AuthUser) {
    return this.leave.listForReview({ status }, user);
  }

  @Post() @Roles(...STAFF_ROLES)
  create(@Body() dto: CreateLeaveApplicationDto, @CurrentUser() user: AuthUser) { return this.leave.create(dto, user); }

  @Patch(":id/review") @Roles(...LEAVE_ADMIN_ROLES)
  review(@Param("id") id: string, @Body() dto: ReviewLeaveApplicationDto, @CurrentUser() user: AuthUser) {
    return this.leave.review(id, dto, user);
  }

  @Delete(":id") @Roles(...STAFF_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.leave.remove(id, user); }
}

@Module({
  controllers: [LeaveTypesController, LeaveBalancesController, LeaveApplicationsController],
  providers: [LeaveService],
})
export class LeaveModule {}
