import { Controller, Get, Injectable, Module, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma, Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  /** Cross-tenant by design -- this is the Super Admin platform-wide
   * activity monitor, matching PlatformService's cross-tenant queries.
   * Every filter is optional; omit all of them to see the full feed. */
  async list(params: {
    userId?: string; action?: string; entity?: string; q?: string;
    from?: string; to?: string; page?: number; pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

    const where: Prisma.AuditLogWhereInput = {
      ...(params.userId && { userId: params.userId }),
      ...(params.action && { action: { startsWith: params.action } }),
      ...(params.entity && { entity: params.entity }),
      ...((params.from || params.to) && {
        createdAt: {
          ...(params.from && { gte: new Date(params.from) }),
          ...(params.to && { lte: new Date(params.to) }),
        },
      }),
      ...(params.q && {
        OR: [
          { action: { contains: params.q, mode: "insensitive" } },
          { entity: { contains: params.q, mode: "insensitive" } },
          { user: { fullName: { contains: params.q, mode: "insensitive" } } },
          { user: { email: { contains: params.q, mode: "insensitive" } } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { rows, total, page, pageSize };
  }

  /** Distinct action/entity values already on record, for the filter
   * dropdowns -- avoids hardcoding a list that drifts from what modules
   * actually log. */
  async filterOptions() {
    const [actions, entities] = await Promise.all([
      this.prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
      this.prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    ]);
    return { actions: actions.map((a) => a.action), entities: entities.map((e) => e.entity) };
  }
}

@ApiTags("audit-logs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("audit-logs")
export class AuditLogsController {
  constructor(private svc: AuditLogsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  list(
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("entity") entity?: string,
    @Query("q") q?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.list({
      userId, action, entity, q, from, to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get("filter-options")
  @Roles(Role.SUPER_ADMIN)
  filterOptions() {
    return this.svc.filterOptions();
  }
}

@Module({ controllers: [AuditLogsController], providers: [AuditLogsService] })
export class AuditLogsModule {}
