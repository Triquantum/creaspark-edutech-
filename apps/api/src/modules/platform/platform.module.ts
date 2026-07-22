import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

/**
 * Cross-tenant platform overview for SUPER_ADMIN — deliberately queries
 * without a tenantId filter (every other module scopes to currentTenant()).
 * Safe only because the route is SUPER_ADMIN-gated.
 */
@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    const [totalSchools, totalStudents, totalTeachers, totalParents, tenants, studentsByTenant, teachersByTenant, parentsByTenant] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.student.count(),
        this.prisma.user.count({ where: { role: Role.TEACHER } }),
        this.prisma.user.count({ where: { role: Role.PARENT } }),
        this.prisma.tenant.findMany({
          select: { id: true, name: true, slug: true, plan: true, status: true, createdAt: true },
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
      schools: tenants.map((t) => ({
        id: t.id, name: t.name, slug: t.slug, plan: t.plan, status: t.status, createdAt: t.createdAt,
        students: studentMap.get(t.id) ?? 0,
        teachers: teacherMap.get(t.id) ?? 0,
        parents: parentMap.get(t.id) ?? 0,
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
}

@Module({ controllers: [PlatformController], providers: [PlatformService] })
export class PlatformModule {}
