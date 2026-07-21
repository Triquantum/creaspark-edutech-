import {
  Body, ConflictException, Controller, Delete, Get, Injectable, Module,
  NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsOptional, IsString } from "class-validator";
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
export class SubjectDto { @IsString() name: string; @IsOptional() @IsString() code?: string }
export class SubjectUpdateDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() code?: string }
export class DepartmentDto { @IsString() schoolId: string; @IsString() name: string }
export class DepartmentUpdateDto { @IsOptional() @IsString() name?: string }

@Injectable()
export class AcademicService {
  constructor(private prisma: PrismaService) {}

  private audit(userId: string, action: string, entity: string, entityId: string) {
    const { tenantId } = currentTenant();
    return this.prisma.auditLog.create({ data: { tenantId, userId, action, entity, entityId } });
  }

  // ── Schools (picker) ──
  async schools() {
    const { tenantId } = currentTenant();
    return this.prisma.school.findMany({
      where: { tenantId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" },
    });
  }

  // ── Classes ──
  async classes() {
    const { tenantId } = currentTenant();
    const rows = await this.prisma.class.findMany({
      where: { tenantId },
      include: { _count: { select: { sections: true } }, school: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, schoolId: c.schoolId, schoolName: c.school.name, sectionCount: c._count.sections }));
  }
  async createClass(dto: ClassDto, actor: string) {
    const { tenantId } = currentTenant();
    const exists = await this.prisma.class.findUnique({ where: { schoolId_name: { schoolId: dto.schoolId, name: dto.name } } });
    if (exists) throw new ConflictException(`Class "${dto.name}" already exists in this school`);
    const c = await this.prisma.class.create({ data: { tenantId, schoolId: dto.schoolId, name: dto.name } });
    await this.audit(actor, "class.create", "Class", c.id);
    return c;
  }
  async updateClass(id: string, dto: ClassUpdateDto, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.class.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Class not found");
    const c = await this.prisma.class.update({ where: { id }, data: dto });
    await this.audit(actor, "class.update", "Class", id);
    return c;
  }
  async deleteClass(id: string, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.class.findFirst({ where: { id, tenantId }, include: { _count: { select: { sections: true } } } });
    if (!existing) throw new NotFoundException("Class not found");
    if (existing._count.sections > 0)
      throw new ConflictException(`Delete or move its ${existing._count.sections} division(s) first`);
    await this.prisma.class.delete({ where: { id } });
    await this.audit(actor, "class.delete", "Class", id);
    return { deleted: true };
  }

  // ── Sections (divisions) ──
  async sections() {
    const { tenantId } = currentTenant();
    const rows = await this.prisma.section.findMany({
      where: { tenantId },
      include: { class: { select: { name: true, schoolId: true } }, _count: { select: { students: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    });
    return rows.map((s) => ({
      id: s.id, name: s.name, classId: s.classId, className: s.class.name,
      schoolId: s.class.schoolId, studentCount: s._count.students,
      label: `${s.class.name} · ${s.name}`,
    }));
  }
  async createSection(dto: SectionDto, actor: string) {
    const { tenantId } = currentTenant();
    const cls = await this.prisma.class.findFirst({ where: { id: dto.classId, tenantId } });
    if (!cls) throw new NotFoundException("Class not found");
    const exists = await this.prisma.section.findUnique({ where: { classId_name: { classId: dto.classId, name: dto.name } } });
    if (exists) throw new ConflictException(`Division "${dto.name}" already exists in ${cls.name}`);
    const s = await this.prisma.section.create({ data: { tenantId, classId: dto.classId, name: dto.name } });
    await this.audit(actor, "section.create", "Section", s.id);
    return s;
  }
  async updateSection(id: string, dto: SectionUpdateDto, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.section.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Division not found");
    const s = await this.prisma.section.update({ where: { id }, data: dto });
    await this.audit(actor, "section.update", "Section", id);
    return s;
  }
  async deleteSection(id: string, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.section.findFirst({
      where: { id, tenantId }, include: { _count: { select: { students: true } } },
    });
    if (!existing) throw new NotFoundException("Division not found");
    if (existing._count.students > 0)
      throw new ConflictException(`Move its ${existing._count.students} student(s) to another division first`);
    await this.prisma.section.delete({ where: { id } });
    await this.audit(actor, "section.delete", "Section", id);
    return { deleted: true };
  }

  // ── Subjects ──
  async subjects() {
    const { tenantId } = currentTenant();
    return this.prisma.subject.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }
  async createSubject(dto: SubjectDto, actor: string) {
    const { tenantId } = currentTenant();
    const s = await this.prisma.subject.create({ data: { tenantId, name: dto.name, code: dto.code } });
    await this.audit(actor, "subject.create", "Subject", s.id);
    return s;
  }
  async updateSubject(id: string, dto: SubjectUpdateDto, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.subject.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Subject not found");
    const s = await this.prisma.subject.update({ where: { id }, data: dto });
    await this.audit(actor, "subject.update", "Subject", id);
    return s;
  }
  async deleteSubject(id: string, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.subject.findFirst({
      where: { id, tenantId }, include: { _count: { select: { exams: true } } },
    });
    if (!existing) throw new NotFoundException("Subject not found");
    if (existing._count.exams > 0)
      throw new ConflictException("This subject is used in exams and can't be deleted");
    await this.prisma.subject.delete({ where: { id } });
    await this.audit(actor, "subject.delete", "Subject", id);
    return { deleted: true };
  }

  // ── Departments ──
  async departments() {
    const { tenantId } = currentTenant();
    const rows = await this.prisma.department.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
    // staff count per department (department is stored by name on StaffProfile)
    const counts = await this.prisma.staffProfile.groupBy({
      by: ["department"], where: { tenantId, department: { not: null } }, _count: true,
    });
    const byName = new Map(counts.map((c) => [c.department, c._count]));
    return rows.map((d) => ({ ...d, staffCount: byName.get(d.name) ?? 0 }));
  }
  async createDepartment(dto: DepartmentDto, actor: string) {
    const { tenantId } = currentTenant();
    const exists = await this.prisma.department.findUnique({ where: { schoolId_name: { schoolId: dto.schoolId, name: dto.name } } });
    if (exists) throw new ConflictException(`Department "${dto.name}" already exists`);
    const d = await this.prisma.department.create({ data: { tenantId, schoolId: dto.schoolId, name: dto.name } });
    await this.audit(actor, "department.create", "Department", d.id);
    return d;
  }
  async updateDepartment(id: string, dto: DepartmentUpdateDto, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Department not found");
    const d = await this.prisma.department.update({ where: { id }, data: dto });
    await this.audit(actor, "department.update", "Department", id);
    return d;
  }
  async deleteDepartment(id: string, actor: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Department not found");
    await this.prisma.department.delete({ where: { id } });
    await this.audit(actor, "department.delete", "Department", id);
    return { deleted: true };
  }
}

const MANAGE = [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR] as const;

@ApiTags("academic")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("academic")
export class AcademicController {
  constructor(private svc: AcademicService) {}

  @Get("schools") schools() { return this.svc.schools(); }

  // Classes
  @Get("classes") classes() { return this.svc.classes(); }
  @Post("classes") @Roles(...MANAGE)
  createClass(@Body() dto: ClassDto, @CurrentUser() u: AuthUser) { return this.svc.createClass(dto, u.id); }
  @Patch("classes/:id") @Roles(...MANAGE)
  updateClass(@Param("id") id: string, @Body() dto: ClassUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateClass(id, dto, u.id); }
  @Delete("classes/:id") @Roles(Role.SCHOOL_ADMIN)
  deleteClass(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteClass(id, u.id); }

  // Sections / divisions
  @Get("sections") sections() { return this.svc.sections(); }
  @Post("sections") @Roles(...MANAGE)
  createSection(@Body() dto: SectionDto, @CurrentUser() u: AuthUser) { return this.svc.createSection(dto, u.id); }
  @Patch("sections/:id") @Roles(...MANAGE)
  updateSection(@Param("id") id: string, @Body() dto: SectionUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateSection(id, dto, u.id); }
  @Delete("sections/:id") @Roles(Role.SCHOOL_ADMIN)
  deleteSection(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteSection(id, u.id); }

  // Subjects
  @Get("subjects") subjects() { return this.svc.subjects(); }
  @Post("subjects") @Roles(...MANAGE)
  createSubject(@Body() dto: SubjectDto, @CurrentUser() u: AuthUser) { return this.svc.createSubject(dto, u.id); }
  @Patch("subjects/:id") @Roles(...MANAGE)
  updateSubject(@Param("id") id: string, @Body() dto: SubjectUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateSubject(id, dto, u.id); }
  @Delete("subjects/:id") @Roles(Role.SCHOOL_ADMIN)
  deleteSubject(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteSubject(id, u.id); }

  // Departments
  @Get("departments") departments() { return this.svc.departments(); }
  @Post("departments") @Roles(Role.SCHOOL_ADMIN, Role.HR)
  createDepartment(@Body() dto: DepartmentDto, @CurrentUser() u: AuthUser) { return this.svc.createDepartment(dto, u.id); }
  @Patch("departments/:id") @Roles(Role.SCHOOL_ADMIN, Role.HR)
  updateDepartment(@Param("id") id: string, @Body() dto: DepartmentUpdateDto, @CurrentUser() u: AuthUser) { return this.svc.updateDepartment(id, dto, u.id); }
  @Delete("departments/:id") @Roles(Role.SCHOOL_ADMIN)
  deleteDepartment(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.deleteDepartment(id, u.id); }
}

@Module({ controllers: [AcademicController], providers: [AcademicService] })
export class AcademicModule {}
