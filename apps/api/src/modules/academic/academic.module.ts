import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, Module,
  NotFoundException, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

// ── DTOs ──
export class ClassDto { @IsString() schoolId: string; @IsString() name: string }
export class ClassUpdateDto { @IsOptional() @IsString() name?: string }
export class SectionDto { @IsString() classId: string; @IsString() name: string }
export class SectionUpdateDto { @IsOptional() @IsString() classId?: string; @IsOptional() @IsString() name?: string }
export class SubjectDto { @IsOptional() @IsString() schoolId?: string; @IsString() name: string; @IsOptional() @IsString() code?: string }
export class SubjectUpdateDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() code?: string }
export class DepartmentDto { @IsString() schoolId: string; @IsString() name: string }
export class DepartmentUpdateDto { @IsOptional() @IsString() name?: string }
export class AcademicYearDto {
  @IsString() schoolId: string; @IsString() label: string;
  @IsDateString() startDate: string; @IsDateString() endDate: string;
}
export class AcademicYearUpdateDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsDateString() startDate?: string; @IsOptional() @IsDateString() endDate?: string;
}

/**
 * Every write here is scoped to a tenant. For ordinary school staff that's
 * always `currentTenant()`. SUPER_ADMIN has no real school of their own —
 * their JWT tenant is the platform placeholder — so for them tenantId is
 * resolved from the `schoolId` they explicitly picked, cross-tenant, the
 * same pattern VisitorsService uses.
 */
@Injectable()
export class AcademicService {
  constructor(private prisma: PrismaService) {}

  private async resolveTenant(user: AuthUser, schoolId?: string): Promise<{ tenantId: string; schoolId?: string }> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!schoolId) throw new BadRequestException("schoolId is required for Super Admin");
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId, schoolId: school.id };
    }
    const { tenantId } = currentTenant();
    return { tenantId, schoolId };
  }

  private audit(userId: string, action: string, entity: string, entityId: string, tenantId: string) {
    return this.prisma.auditLog.create({ data: { tenantId, userId, action, entity, entityId } });
  }

  // ── Schools (picker) ──
  async schools(user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN) {
      const rows = await this.prisma.school.findMany({
        select: { id: true, name: true, code: true, tenant: { select: { name: true } } },
        orderBy: { name: "asc" },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, code: r.code, tenantName: r.tenant.name }));
    }
    const { tenantId } = currentTenant();
    return this.prisma.school.findMany({
      where: { tenantId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" },
    });
  }

  /** Read-only tenant scope: cross-tenant (all schools) for SUPER_ADMIN when
   * no schoolId filter is given, else the caller's own tenant. Unlike
   * resolveTenant(), never throws — reads have a sensible "show everything"
   * default, only writes must pin down a single school. */
  private async readScope(user: AuthUser, schoolId?: string): Promise<{ tenantId?: string; schoolId?: string }> {
    if (user.role === Role.SUPER_ADMIN) return { schoolId };
    const { tenantId } = currentTenant();
    return { tenantId, schoolId };
  }

  // ── Classes ──
  async classes(user: AuthUser, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    const rows = await this.prisma.class.findMany({
      where: { ...(scope.tenantId && { tenantId: scope.tenantId }), ...(scope.schoolId && { schoolId: scope.schoolId }) },
      include: { _count: { select: { sections: true } }, school: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, schoolId: c.schoolId, schoolName: c.school.name, sectionCount: c._count.sections }));
  }
  async createClass(dto: ClassDto, user: AuthUser, actor: string) {
    const { tenantId } = await this.resolveTenant(user, dto.schoolId);
    const exists = await this.prisma.class.findUnique({ where: { schoolId_name: { schoolId: dto.schoolId, name: dto.name } } });
    if (exists) throw new ConflictException(`Class "${dto.name}" already exists in this school`);
    const c = await this.prisma.class.create({ data: { tenantId, schoolId: dto.schoolId, name: dto.name } });
    await this.audit(actor, "class.create", "Class", c.id, tenantId);
    return c;
  }
  async updateClass(id: string, dto: ClassUpdateDto, user: AuthUser, actor: string) {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Class not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Class not found");
    const c = await this.prisma.class.update({ where: { id }, data: dto });
    await this.audit(actor, "class.update", "Class", id, tenantId);
    return c;
  }
  async deleteClass(id: string, user: AuthUser, actor: string) {
    const existing = await this.prisma.class.findUnique({ where: { id }, include: { _count: { select: { sections: true } } } });
    if (!existing) throw new NotFoundException("Class not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Class not found");
    if (existing._count.sections > 0)
      throw new ConflictException(`Delete or move its ${existing._count.sections} division(s) first`);
    await this.prisma.class.delete({ where: { id } });
    await this.audit(actor, "class.delete", "Class", id, tenantId);
    return { deleted: true };
  }

  // ── Sections (divisions) ──
  async sections(user: AuthUser, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    const rows = await this.prisma.section.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        ...(scope.schoolId && { class: { schoolId: scope.schoolId } }),
      },
      include: { class: { select: { name: true, schoolId: true } }, _count: { select: { students: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    });
    return rows.map((s) => ({
      id: s.id, name: s.name, classId: s.classId, className: s.class.name,
      schoolId: s.class.schoolId, studentCount: s._count.students,
      label: `${s.class.name} · ${s.name}`,
    }));
  }
  async createSection(dto: SectionDto, user: AuthUser, actor: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: dto.classId } });
    if (!cls) throw new NotFoundException("Class not found");
    const { tenantId } = await this.resolveTenant(user, cls.schoolId);
    if (cls.tenantId !== tenantId) throw new NotFoundException("Class not found");
    const exists = await this.prisma.section.findUnique({ where: { classId_name: { classId: dto.classId, name: dto.name } } });
    if (exists) throw new ConflictException(`Division "${dto.name}" already exists in ${cls.name}`);
    const s = await this.prisma.section.create({ data: { tenantId, classId: dto.classId, name: dto.name } });
    await this.audit(actor, "section.create", "Section", s.id, tenantId);
    return s;
  }
  async updateSection(id: string, dto: SectionUpdateDto, user: AuthUser, actor: string) {
    const existing = await this.prisma.section.findUnique({ where: { id }, include: { class: true } });
    if (!existing) throw new NotFoundException("Division not found");
    const { tenantId } = await this.resolveTenant(user, existing.class.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Division not found");
    const s = await this.prisma.section.update({ where: { id }, data: dto });
    await this.audit(actor, "section.update", "Section", id, tenantId);
    return s;
  }
  async deleteSection(id: string, user: AuthUser, actor: string) {
    const existing = await this.prisma.section.findUnique({
      where: { id }, include: { class: true, _count: { select: { students: true } } },
    });
    if (!existing) throw new NotFoundException("Division not found");
    const { tenantId } = await this.resolveTenant(user, existing.class.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Division not found");
    if (existing._count.students > 0)
      throw new ConflictException(`Move its ${existing._count.students} student(s) to another division first`);
    await this.prisma.section.delete({ where: { id } });
    await this.audit(actor, "section.delete", "Section", id, tenantId);
    return { deleted: true };
  }

  // ── Subjects ──
  async subjects(user: AuthUser, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    return this.prisma.subject.findMany({
      where: { ...(scope.tenantId && { tenantId: scope.tenantId }) },
      orderBy: { name: "asc" },
    });
  }
  async createSubject(dto: SubjectDto, user: AuthUser, actor: string) {
    const { tenantId } = await this.resolveTenant(user, dto.schoolId);
    const s = await this.prisma.subject.create({ data: { tenantId, name: dto.name, code: dto.code, schoolIdRef: dto.schoolId } });
    await this.audit(actor, "subject.create", "Subject", s.id, tenantId);
    return s;
  }
  async updateSubject(id: string, dto: SubjectUpdateDto, user: AuthUser, actor: string) {
    const existing = await this.prisma.subject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Subject not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolIdRef ?? undefined);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Subject not found");
    const s = await this.prisma.subject.update({ where: { id }, data: dto });
    await this.audit(actor, "subject.update", "Subject", id, tenantId);
    return s;
  }
  async deleteSubject(id: string, user: AuthUser, actor: string) {
    const existing = await this.prisma.subject.findUnique({
      where: { id }, include: { _count: { select: { exams: true } } },
    });
    if (!existing) throw new NotFoundException("Subject not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolIdRef ?? undefined);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Subject not found");
    if (existing._count.exams > 0)
      throw new ConflictException("This subject is used in exams and can't be deleted");
    await this.prisma.subject.delete({ where: { id } });
    await this.audit(actor, "subject.delete", "Subject", id, tenantId);
    return { deleted: true };
  }

  // ── Departments ──
  async departments(user: AuthUser, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    const rows = await this.prisma.department.findMany({
      where: { ...(scope.tenantId && { tenantId: scope.tenantId }), ...(scope.schoolId && { schoolId: scope.schoolId }) },
      orderBy: { name: "asc" },
    });
    const counts = await this.prisma.staffProfile.groupBy({
      by: ["department"], where: { ...(scope.tenantId && { tenantId: scope.tenantId }), department: { not: null } }, _count: true,
    });
    const byName = new Map(counts.map((c) => [c.department, c._count]));
    return rows.map((d) => ({ ...d, staffCount: byName.get(d.name) ?? 0 }));
  }
  async createDepartment(dto: DepartmentDto, user: AuthUser, actor: string) {
    const { tenantId } = await this.resolveTenant(user, dto.schoolId);
    const exists = await this.prisma.department.findUnique({ where: { schoolId_name: { schoolId: dto.schoolId, name: dto.name } } });
    if (exists) throw new ConflictException(`Department "${dto.name}" already exists`);
    const d = await this.prisma.department.create({ data: { tenantId, schoolId: dto.schoolId, name: dto.name } });
    await this.audit(actor, "department.create", "Department", d.id, tenantId);
    return d;
  }
  async updateDepartment(id: string, dto: DepartmentUpdateDto, user: AuthUser, actor: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Department not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Department not found");
    const d = await this.prisma.department.update({ where: { id }, data: dto });
    await this.audit(actor, "department.update", "Department", id, tenantId);
    return d;
  }
  async deleteDepartment(id: string, user: AuthUser, actor: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Department not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Department not found");
    await this.prisma.department.delete({ where: { id } });
    await this.audit(actor, "department.delete", "Department", id, tenantId);
    return { deleted: true };
  }

  // ── Academic Years ──
  async academicYears(user: AuthUser, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    return this.prisma.academicYear.findMany({
      where: { ...(scope.tenantId && { tenantId: scope.tenantId }), ...(scope.schoolId && { schoolId: scope.schoolId }) },
      orderBy: { startDate: "desc" },
    });
  }
  async createAcademicYear(dto: AcademicYearDto, user: AuthUser, actor: string) {
    const { tenantId } = await this.resolveTenant(user, dto.schoolId);
    const exists = await this.prisma.academicYear.findUnique({ where: { schoolId_label: { schoolId: dto.schoolId, label: dto.label } } });
    if (exists) throw new ConflictException(`Academic year "${dto.label}" already exists`);
    const y = await this.prisma.academicYear.create({
      data: { tenantId, schoolId: dto.schoolId, label: dto.label, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
    });
    await this.audit(actor, "academicYear.create", "AcademicYear", y.id, tenantId);
    return y;
  }
  async updateAcademicYear(id: string, dto: AcademicYearUpdateDto, user: AuthUser, actor: string) {
    const existing = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Academic year not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Academic year not found");
    const y = await this.prisma.academicYear.update({
      where: { id },
      data: { ...dto, startDate: dto.startDate ? new Date(dto.startDate) : undefined, endDate: dto.endDate ? new Date(dto.endDate) : undefined },
    });
    await this.audit(actor, "academicYear.update", "AcademicYear", id, tenantId);
    return y;
  }
  async setCurrentAcademicYear(id: string, user: AuthUser, actor: string) {
    const existing = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Academic year not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Academic year not found");
    await this.prisma.$transaction([
      this.prisma.academicYear.updateMany({ where: { schoolId: existing.schoolId }, data: { isCurrent: false } }),
      this.prisma.academicYear.update({ where: { id }, data: { isCurrent: true } }),
    ]);
    await this.audit(actor, "academicYear.setCurrent", "AcademicYear", id, tenantId);
    return { updated: true };
  }
  async deleteAcademicYear(id: string, user: AuthUser, actor: string) {
    const existing = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Academic year not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Academic year not found");
    await this.prisma.academicYear.delete({ where: { id } });
    await this.audit(actor, "academicYear.delete", "AcademicYear", id, tenantId);
    return { deleted: true };
  }
}

const MANAGE = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR] as const;
const DELETE_ONLY = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN] as const;

@ApiTags("academic")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("academic")
export class AcademicController {
  constructor(private svc: AcademicService) {}

  @Get("schools") schools(@CurrentUser() u: AuthUser) { return this.svc.schools(u); }

  // Classes
  @Get("classes") classes(@CurrentUser() u: AuthUser, @Query("schoolId") schoolId?: string) { return this.svc.classes(u, schoolId); }
  @Post("classes") @Roles(...MANAGE)
  createClass(@Body() dto: ClassDto, @CurrentUser() u: AuthUser) { return this.svc.createClass(dto, u, u.id); }
  @Patch("classes/:id") @Roles(...MANAGE)
  updateClass(@Param("id") id: string, @Body() dto: ClassUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateClass(id, dto, u, u.id); }
  @Delete("classes/:id") @Roles(...DELETE_ONLY)
  deleteClass(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteClass(id, u, u.id); }

  // Sections / divisions
  @Get("sections") sections(@CurrentUser() u: AuthUser, @Query("schoolId") schoolId?: string) { return this.svc.sections(u, schoolId); }
  @Post("sections") @Roles(...MANAGE)
  createSection(@Body() dto: SectionDto, @CurrentUser() u: AuthUser) { return this.svc.createSection(dto, u, u.id); }
  @Patch("sections/:id") @Roles(...MANAGE)
  updateSection(@Param("id") id: string, @Body() dto: SectionUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateSection(id, dto, u, u.id); }
  @Delete("sections/:id") @Roles(...DELETE_ONLY)
  deleteSection(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteSection(id, u, u.id); }

  // Subjects
  @Get("subjects") subjects(@CurrentUser() u: AuthUser, @Query("schoolId") schoolId?: string) { return this.svc.subjects(u, schoolId); }
  @Post("subjects") @Roles(...MANAGE)
  createSubject(@Body() dto: SubjectDto, @CurrentUser() u: AuthUser) { return this.svc.createSubject(dto, u, u.id); }
  @Patch("subjects/:id") @Roles(...MANAGE)
  updateSubject(@Param("id") id: string, @Body() dto: SubjectUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateSubject(id, dto, u, u.id); }
  @Delete("subjects/:id") @Roles(...DELETE_ONLY)
  deleteSubject(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteSubject(id, u, u.id); }

  // Departments
  @Get("departments") departments(@CurrentUser() u: AuthUser, @Query("schoolId") schoolId?: string) { return this.svc.departments(u, schoolId); }
  @Post("departments") @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.HR)
  createDepartment(@Body() dto: DepartmentDto, @CurrentUser() u: AuthUser) { return this.svc.createDepartment(dto, u, u.id); }
  @Patch("departments/:id") @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.HR)
  updateDepartment(@Param("id") id: string, @Body() dto: DepartmentUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateDepartment(id, dto, u, u.id); }
  @Delete("departments/:id") @Roles(...DELETE_ONLY)
  deleteDepartment(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteDepartment(id, u, u.id); }

  // Academic Years
  @Get("academic-years") academicYears(@CurrentUser() u: AuthUser, @Query("schoolId") schoolId?: string) { return this.svc.academicYears(u, schoolId); }
  @Post("academic-years") @Roles(...MANAGE)
  createAcademicYear(@Body() dto: AcademicYearDto, @CurrentUser() u: AuthUser) { return this.svc.createAcademicYear(dto, u, u.id); }
  @Patch("academic-years/:id") @Roles(...MANAGE)
  updateAcademicYear(@Param("id") id: string, @Body() dto: AcademicYearUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateAcademicYear(id, dto, u, u.id); }
  @Patch("academic-years/:id/set-current") @Roles(...MANAGE)
  setCurrentAcademicYear(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.setCurrentAcademicYear(id, u, u.id); }
  @Delete("academic-years/:id") @Roles(...DELETE_ONLY)
  deleteAcademicYear(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteAcademicYear(id, u, u.id); }
}

@Module({ controllers: [AcademicController], providers: [AcademicService] })
export class AcademicModule {}
