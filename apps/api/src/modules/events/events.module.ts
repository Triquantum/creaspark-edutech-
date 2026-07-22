import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsArray, IsDateString, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateEventDto {
  @IsString() schoolId: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
  @IsDateString() startAt: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsArray() audience?: Role[];
}

const MANAGE = [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR, Role.TEACHER] as const;

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  /** Events visible to `role`, filtered to a calendar month when given (YYYY-MM), else the next 10 upcoming. */
  list(role: Role, month?: string) {
    const { tenantId } = currentTenant();
    const audienceFilter = { OR: [{ audience: { has: role } }, { audience: { isEmpty: true } }] };

    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      return this.prisma.event.findMany({
        where: { tenantId, ...audienceFilter, startAt: { gte: start, lt: end } },
        orderBy: { startAt: "asc" },
      });
    }

    return this.prisma.event.findMany({
      where: { tenantId, ...audienceFilter, startAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      take: 10,
    });
  }

  async create(dto: CreateEventDto, actorId: string) {
    const { tenantId } = currentTenant();
    const event = await this.prisma.event.create({
      data: {
        tenantId, schoolId: dto.schoolId, title: dto.title, description: dto.description,
        location: dto.location, startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        audience: dto.audience ?? [], createdBy: actorId,
      },
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "event.create", entity: "Event", entityId: event.id },
    });
    return event;
  }

  async remove(id: string, actorId: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.event.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Event not found");
    await this.prisma.event.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "event.delete", entity: "Event", entityId: id },
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
  list(@CurrentUser() user: AuthUser, @Query("month") month?: string) {
    return this.svc.list(user.role as Role, month);
  }

  @Post()
  @Roles(...MANAGE)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user.id);
  }

  @Delete(":id")
  @Roles(...MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user.id);
  }
}

@Module({ controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
