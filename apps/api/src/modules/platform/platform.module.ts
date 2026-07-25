import {
  Body, ConflictException, Controller, Delete, Get, Injectable, Module,
  NotFoundException, Param, Patch, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Board, Plan, Role, TenantStatus } from "@educore/database";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

export class UpdateSchoolDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsEnum(Board) board?: Board;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsEnum(Plan) plan?: Plan;
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
}

/**
 * Cross-tenant platform overview for SUPER_ADMIN — deliberately queries
 * without a tenantId filter (every other module scopes to currentTenant()).
 * Safe only because the route is SUPER_ADMIN-gated.
 */
@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    const [totalSchools, totalStudents, totalTeachers, totalParents, schools, studentsByTenant, teachersByTenant, parentsByTenant] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.student.count(),
        this.prisma.user.count({ where: { role: Role.TEACHER } }),
        this.prisma.user.count({ where: { role: Role.PARENT } }),
        // registerSchool creates exactly one Tenant + one School together, so
        // this join gives the real School.id the drill-down page needs,
        // while still keying counts off tenantId like every other module.
        this.prisma.school.findMany({
          select: { id: true, name: true, tenant: { select: { id: true, slug: true, plan: true, status: true, createdAt: true } } },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.student.groupBy({ by: ["tenantId"], _count: true }),
        this.prisma.user.groupBy({ by: ["tenantId"], where: { role: Role.TEACHER }, _count: true }),
        this.prisma.user.groupBy({ by: ["tenantId"], where: { role: Role.PARENT }, _count: true }),
      ]);

    const studentMap = new Map(studentsByTenant.map((s) => [s.tenantId, s._count]));
    const teacherMap = new Map(teachersByTenant.map((t) => [t.tenantId, t._count]));
    const parentMap = new Map(parentsByTenant.map((p) => [p.tenantId, p._count]));

    return {
      totalSchools,
      totalStudents,
      totalTeachers,
      totalParents,
      schools: schools.map((s) => ({
        id: s.id, name: s.name, slug: s.tenant.slug, plan: s.tenant.plan, status: s.tenant.status, createdAt: s.tenant.createdAt,
        students: studentMap.get(s.tenant.id) ?? 0,
        teachers: teacherMap.get(s.tenant.id) ?? 0,
        parents: parentMap.get(s.tenant.id) ?? 0,
      })),
    };
  }

  /** Every physical school (not tenant) across the platform, for cross-tenant pickers. */
  async schools() {
    const rows = await this.prisma.school.findMany({
      select: { id: true, name: true, code: true, tenant: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, code: r.code, tenantName: r.tenant.name }));
  }

  /** Full roster for one school — the school-wise drill-down from the
   * platform overview. Capped lists (not paginated) since this is a
   * summary view; each list links out to the real module for full CRUD. */
  async schoolDetail(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { tenant: { select: { name: true, plan: true, status: true } } },
    });
    if (!school) throw new NotFoundException("School not found");

    const [students, teachers, parents, classes, subjects] = await Promise.all([
      this.prisma.student.findMany({
        where: { schoolId: id },
        select: {
          id: true, firstName: true, lastName: true, admissionNo: true, status: true,
          section: { select: { name: true, class: { select: { name: true } } } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 500,
      }),
      this.prisma.user.findMany({
        where: { role: Role.TEACHER, staffProfile: { schoolId: id } },
        select: {
          id: true, fullName: true, email: true, isActive: true,
          staffProfile: { select: { employeeNo: true, designation: true, department: true } },
        },
        orderBy: { fullName: "asc" },
        take: 500,
      }),
      this.prisma.guardian.findMany({
        where: { student: { schoolId: id } },
        select: { id: true, fullName: true, phone: true, email: true, relation: true, student: { select: { firstName: true, lastName: true } } },
        distinct: ["phone"],
        take: 500,
      }),
      this.prisma.class.findMany({
        where: { schoolId: id },
        select: { id: true, name: true, _count: { select: { sections: true } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.subject.findMany({
        where: { OR: [{ schoolIdRef: id }, { tenantId: school.tenantId, schoolIdRef: null }] },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      school: {
        id: school.id, name: school.name, code: school.code, board: school.board,
        city: school.city, state: school.state, phone: school.phone, email: school.email,
        tenantName: school.tenant.name, plan: school.tenant.plan, status: school.tenant.status,
      },
      students: students.map((s) => ({
        id: s.id, name: `${s.firstName} ${s.lastName}`, admissionNo: s.admissionNo, status: s.status,
        classLabel: s.section ? `${s.section.class.name} · ${s.section.name}` : "Unassigned",
      })),
      teachers: teachers.map((t) => ({
        id: t.id, name: t.fullName, email: t.email, isActive: t.isActive,
        employeeNo: t.staffProfile?.employeeNo ?? "—", designation: t.staffProfile?.designation ?? "—",
        department: t.staffProfile?.department ?? "—",
      })),
      parents: parents.map((p) => ({
        id: p.id, name: p.fullName, phone: p.phone, email: p.email, relation: p.relation,
        studentName: `${p.student.firstName} ${p.student.lastName}`,
      })),
      classes: classes.map((c) => ({ id: c.id, name: c.name, sectionCount: c._count.sections })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    };
  }

  /** Updates the School row and, if plan/status were sent, the Tenant row
   * alongside it — one form on the frontend, two tables underneath. */
  async updateSchool(id: string, dto: UpdateSchoolDto) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException("School not found");

    if (dto.code && dto.code !== school.code) {
      const clash = await this.prisma.school.findUnique({
        where: { tenantId_code: { tenantId: school.tenantId, code: dto.code } },
      });
      if (clash) throw new ConflictException(`School code "${dto.code}" already exists`);
    }

    const { plan, status, ...schoolFields } = dto;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.school.update({ where: { id }, data: schoolFields });
      if (plan || status) {
        await tx.tenant.update({
          where: { id: school.tenantId },
          data: { ...(plan && { plan }), ...(status && { status }) },
        });
      }
      return updated;
    });
  }

  /** Hard delete only when the school is an empty shell — any real student
   * or staff history must be preserved, same rule StudentsService applies
   * to individual students. Suspend the tenant instead for anything else. */
  async deleteSchool(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { _count: { select: { students: true, staff: true } } },
    });
    if (!school) throw new NotFoundException("School not found");
    if (school._count.students > 0 || school._count.staff > 0) {
      throw new ConflictException(
        "This school has students or staff on record. Set its status to Suspended instead of deleting, to preserve their data.",
      );
    }
    await this.prisma.school.delete({ where: { id } });
    return { deleted: true };
  }
}

@ApiTags("platform")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform")
export class PlatformController {
  constructor(private svc: PlatformService) {}

  @Get("summary")
  @Roles(Role.SUPER_ADMIN)
  summary() {
    return this.svc.summary();
  }

  @Get("schools")
  @Roles(Role.SUPER_ADMIN)
  schools() {
    return this.svc.schools();
  }

  @Get("schools/:id")
  @Roles(Role.SUPER_ADMIN)
  schoolDetail(@Param("id") id: string) {
    return this.svc.schoolDetail(id);
  }

  @Patch("schools/:id")
  @Roles(Role.SUPER_ADMIN)
  updateSchool(@Param("id") id: string, @Body() dto: UpdateSchoolDto) {
    return this.svc.updateSchool(id, dto);
  }

  @Delete("schools/:id")
  @Roles(Role.SUPER_ADMIN)
  deleteSchool(@Param("id") id: string) {
    return this.svc.deleteSchool(id);
  }
}

@Module({ controllers: [PlatformController], providers: [PlatformService] })
export class PlatformModule {}
