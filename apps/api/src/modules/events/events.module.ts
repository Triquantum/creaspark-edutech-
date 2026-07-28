import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { EventCategory, Role } from "@educore/database";
import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateEventDto {
  @IsString() schoolId: string;
  @IsString() title: string;
  @IsOptional() @IsEnum(EventCategory) category?: EventCategory;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() pdfUrl?: string;
  @IsDateString() startAt: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsDateString() registrationDeadline?: string;
  @IsOptional() @IsArray() audience?: Role[];
}

export class UpdateEventDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsEnum(EventCategory) category?: EventCategory;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() pdfUrl?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsDateString() registrationDeadline?: string;
  @IsOptional() @IsArray() audience?: Role[];
}

const MANAGE = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR, Role.TEACHER] as const;

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  /** Read-only scope: cross-tenant (every school) for SUPER_ADMIN/ORG_ADMIN
   * when no schoolId filter is given, else the caller's own tenant. */
  private async readScope(user: AuthUser, schoolId?: string): Promise<{ tenantId?: string; schoolId?: string }> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) {
      if (!schoolId) return { tenantId: undefined, schoolId: undefined };
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId, schoolId };
    }
    return { tenantId: currentTenant().tenantId, schoolId };
  }

  /** For creating: SUPER_ADMIN/ORG_ADMIN may target any registered school;
   * everyone else is confined to a school within their own tenant. */
  private async resolveTenantForWrite(user: AuthUser, schoolId: string): Promise<string> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) {
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return school.tenantId;
    }
    const { tenantId } = currentTenant();
    const school = await this.prisma.school.findFirst({ where: { id: schoolId, tenantId } });
    if (!school) throw new NotFoundException("School not found in your organization");
    return tenantId;
  }

  /** For acting on an *existing* event: SUPER_ADMIN/ORG_ADMIN may act on any
   * tenant; everyone else is confined to their own. */
  private assertCanAct(user: AuthUser, targetTenantId: string) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) return;
    if (targetTenantId !== currentTenant().tenantId) throw new NotFoundException("Event not found");
  }

  /** Events visible to `role`, filtered to a calendar month when given (YYYY-MM), else the next 10 upcoming. */
  async list(user: AuthUser, month?: string, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    const audienceFilter = { OR: [{ audience: { has: user.role as Role } }, { audience: { isEmpty: true } }] };
    const where = {
      ...(scope.tenantId && { tenantId: scope.tenantId }),
      ...(scope.schoolId && { schoolId: scope.schoolId }),
      ...audienceFilter,
    };

    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      return this.prisma.event.findMany({
        where: { ...where, startAt: { gte: start, lt: end } },
        orderBy: { startAt: "asc" },
      });
    }

    return this.prisma.event.findMany({
      where: { ...where, startAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      take: 10,
    });
  }

  async create(dto: CreateEventDto, user: AuthUser, actorId: string) {
    const tenantId = await this.resolveTenantForWrite(user, dto.schoolId);
    const event = await this.prisma.event.create({
      data: {
        tenantId, schoolId: dto.schoolId, title: dto.title, category: dto.category,
        description: dto.description, location: dto.location,
        photoUrl: dto.photoUrl, pdfUrl: dto.pdfUrl,
        startAt: new Date(dto.startAt), endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        registrationDeadline: dto.registrationDeadline ? new Date(dto.registrationDeadline) : undefined,
        audience: dto.audience ?? [], createdBy: actorId,
      },
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "event.create", entity: "Event", entityId: event.id },
    });
    return event;
  }

  async update(id: string, dto: UpdateEventDto, user: AuthUser, actorId: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Event not found");
    this.assertCanAct(user, existing.tenantId);

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.pdfUrl !== undefined && { pdfUrl: dto.pdfUrl }),
        ...(dto.startAt !== undefined && { startAt: new Date(dto.startAt) }),
        ...(dto.endAt !== undefined && { endAt: new Date(dto.endAt) }),
        ...(dto.registrationDeadline !== undefined && { registrationDeadline: new Date(dto.registrationDeadline) }),
        ...(dto.audience !== undefined && { audience: dto.audience }),
      },
    });
    await this.prisma.auditLog.create({
      data: { tenantId: existing.tenantId, userId: actorId, action: "event.update", entity: "Event", entityId: id },
    });
    return event;
  }

  async remove(id: string, user: AuthUser, actorId: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Event not found");
    this.assertCanAct(user, existing.tenantId);

    await this.prisma.event.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { tenantId: existing.tenantId, userId: actorId, action: "event.delete", entity: "Event", entityId: id },
    });
    return { deleted: true };
  }
}

@ApiTags("events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("events")
export class EventsController {
  constructor(private svc: EventsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("month") month?: string, @Query("schoolId") schoolId?: string) {
    return this.svc.list(user, month, schoolId);
  }

  @Post()
  @Roles(...MANAGE)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user, user.id);
  }

  @Patch(":id")
  @Roles(...MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user, user.id);
  }

  @Delete(":id")
  @Roles(...MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user, user.id);
  }
}

@Module({ controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
