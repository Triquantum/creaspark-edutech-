import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module,
  NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { CreateHolidayDto, UpdateHolidayDto } from "./holidays.dto";

const MANAGE_ROLES = [
  Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR, Role.ACADEMIC_ADMIN,
] as const;

const HOLIDAY_INCLUDE = { createdBy: { select: { fullName: true } } };

/** Tenant-wide holiday calendar -- replaces the generic GenericRecord
 * catch-all previously used at /announcement/holiday. Read is open to every
 * authenticated role (the Dashboard widget needs it for everyone); only
 * admin-like roles manage entries, same MANAGE_ROLES set used by Tasks. */
@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  private isManager(role: string): boolean {
    return (MANAGE_ROLES as readonly string[]).includes(role);
  }

  async list(user: AuthUser) {
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    return this.prisma.holiday.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }) },
      include: HOLIDAY_INCLUDE,
      orderBy: { startDate: "asc" },
      take: 300,
    });
  }

  private assertDateOrder(startDate: string, endDate: string) {
    if (new Date(endDate) < new Date(startDate)) throw new BadRequestException("End date can't be before start date");
  }

  async create(dto: CreateHolidayDto, user: AuthUser) {
    if (!this.isManager(user.role)) throw new NotFoundException("Not found");
    this.assertDateOrder(dto.startDate, dto.endDate);
    const { tenantId } = currentTenant();
    return this.prisma.holiday.create({
      data: {
        tenantId, subject: dto.subject, description: dto.description, remarks: dto.remarks,
        startDate: new Date(dto.startDate), endDate: new Date(dto.endDate),
        images: dto.images ?? [], createdById: user.id,
      },
      include: HOLIDAY_INCLUDE,
    });
  }

  private async findHoliday(id: string, user: AuthUser) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException("Holiday not found");
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    if (!crossTenant && holiday.tenantId !== currentTenant().tenantId) throw new NotFoundException("Holiday not found");
    return holiday;
  }

  async update(id: string, dto: UpdateHolidayDto, user: AuthUser) {
    if (!this.isManager(user.role)) throw new NotFoundException("Not found");
    const holiday = await this.findHoliday(id, user);
    this.assertDateOrder(dto.startDate ?? holiday.startDate.toISOString(), dto.endDate ?? holiday.endDate.toISOString());
    return this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.images !== undefined && { images: dto.images }),
      },
      include: HOLIDAY_INCLUDE,
    });
  }

  async remove(id: string, user: AuthUser) {
    if (!this.isManager(user.role)) throw new NotFoundException("Not found");
    await this.findHoliday(id, user);
    await this.prisma.holiday.delete({ where: { id } });
    return { deleted: true };
  }
}

@ApiTags("holidays") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("holidays")
export class HolidaysController {
  constructor(private svc: HolidaysService) {}

  @Get() list(@CurrentUser() user: AuthUser) { return this.svc.list(user); }

  @Post() @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateHolidayDto, @CurrentUser() user: AuthUser) { return this.svc.create(dto, user); }

  @Patch(":id") @Roles(...MANAGE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateHolidayDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id") @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.remove(id, user); }
}

@Module({ controllers: [HolidaysController], providers: [HolidaysService] })
export class HolidaysModule {}
