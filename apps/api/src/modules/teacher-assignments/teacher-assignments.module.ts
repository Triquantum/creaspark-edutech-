import {
  BadRequestException, Body, Controller, Delete, Get, Injectable,
  Module, NotFoundException, Param, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class AssignTeacherDto {
  @IsString() sectionId: string;
  @IsString() subjectId: string;
  @IsString() teacherId: string;
}

const PERSON = { select: { id: true, fullName: true } };
const ASSIGNMENT_INCLUDE = {
  teacher: PERSON,
  subject: { select: { id: true, name: true } },
  section: {
    select: {
      id: true, name: true,
      class: { select: { id: true, name: true, schoolId: true, school: { select: { name: true } } } },
    },
  },
};

@Injectable()
export class TeacherAssignmentsService {
  constructor(private prisma: PrismaService) {}

  /** SUPER_ADMIN has no real school of their own; tenantId is resolved from
   * an explicit schoolId instead of currentTenant() — same pattern as
   * AcademicService/StudentsService/TeachersService. */
  private async resolveTenant(user: AuthUser, schoolId?: string): Promise<{ tenantId: string }> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!schoolId) throw new BadRequestException("schoolId is required for Super Admin");
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId };
    }
    const { tenantId } = currentTenant();
    return { tenantId };
  }

  /** Read-only scope: cross-tenant for SUPER_ADMIN when no schoolId filter
   * is given, else the caller's own tenant. Never throws. */
  private readScope(user: AuthUser): { tenantId?: string } {
    if (user.role === Role.SUPER_ADMIN) return {};
    return { tenantId: currentTenant().tenantId };
  }

  list(user: AuthUser, schoolId?: string, sectionId?: string) {
    const scope = this.readScope(user);
    return this.prisma.teacherAssignment.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        ...(schoolId && { section: { class: { schoolId } } }),
        ...(sectionId && { sectionId }),
      },
      include: ASSIGNMENT_INCLUDE,
      orderBy: [{ section: { class: { name: "asc" } } }, { section: { name: "asc" } }, { subject: { name: "asc" } }],
    });
  }

  async assign(dto: AssignTeacherDto, user: AuthUser, actorId: string) {
    const section = await this.prisma.section.findUnique({ where: { id: dto.sectionId }, include: { class: true } });
    if (!section) throw new NotFoundException("Division not found");
    const { tenantId } = await this.resolveTenant(user, section.class.schoolId);
    if (section.tenantId !== tenantId) throw new NotFoundException("Division not found");

    const [subject, teacher] = await Promise.all([
      this.prisma.subject.findFirst({ where: { id: dto.subjectId, tenantId } }),
      this.prisma.user.findFirst({ where: { id: dto.teacherId, tenantId, role: Role.TEACHER } }),
    ]);
    if (!subject) throw new NotFoundException("Subject not found in this school's organization");
    if (!teacher) throw new NotFoundException("Teacher not found in this school's organization");

    // Overwrite rather than error on an existing (section, subject) pair —
    // re-assigning who teaches a slot is the normal edit here, not a conflict.
    const assignment = await this.prisma.teacherAssignment.upsert({
      where: { sectionId_subjectId: { sectionId: dto.sectionId, subjectId: dto.subjectId } },
      create: { tenantId, sectionId: dto.sectionId, subjectId: dto.subjectId, teacherId: dto.teacherId },
      update: { teacherId: dto.teacherId },
      include: ASSIGNMENT_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "teacherAssignment.assign", entity: "TeacherAssignment", entityId: assignment.id },
    });
    return assignment;
  }

  async remove(id: string, user: AuthUser, actorId: string) {
    const existing = await this.prisma.teacherAssignment.findUnique({
      where: { id }, include: { section: { include: { class: true } } },
    });
    if (!existing) throw new NotFoundException("Assignment not found");
    const { tenantId } = await this.resolveTenant(user, existing.section.class.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Assignment not found");
    await this.prisma.teacherAssignment.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "teacherAssignment.remove", entity: "TeacherAssignment", entityId: id },
    });
    return { deleted: true };
  }
}

const MANAGE = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR] as const;

@ApiTags("teacher-assignments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("teacher-assignments")
export class TeacherAssignmentsController {
  constructor(private svc: TeacherAssignmentsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR, Role.TEACHER)
  list(@CurrentUser() u: AuthUser, @Query("schoolId") schoolId?: string, @Query("sectionId") sectionId?: string) {
    return this.svc.list(u, schoolId, sectionId);
  }

  @Post()
  @Roles(...MANAGE)
  assign(@Body() dto: AssignTeacherDto, @CurrentUser() u: AuthUser) {
    return this.svc.assign(dto, u, u.id);
  }

  @Delete(":id")
  @Roles(...MANAGE)
  remove(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.svc.remove(id, u, u.id);
  }
}

@Module({ controllers: [TeacherAssignmentsController], providers: [TeacherAssignmentsService] })
export class TeacherAssignmentsModule {}
