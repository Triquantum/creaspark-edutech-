import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsDateString, IsInt, IsOptional, IsString, Min } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateInventoryItemDto {
  @IsString() schoolId: string;
  @IsString() name: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsDateString() submittedAt?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsString() comments?: string;
}

export class UpdateInventoryItemDto {
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsDateString() submittedAt?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsString() comments?: string;
}

// Manage (upload/edit/delete) and view: platform/org/school admins plus the
// dedicated inventory role — narrower than Media, since this session's
// request didn't ask for teacher/parent/student visibility here.
const MANAGE = [
  Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR,
  Role.INVENTORY_MANAGER, Role.ACADEMIC_ADMIN,
] as const;

@Injectable()
export class InventoryItemService {
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

  /** For creating/redistributing: SUPER_ADMIN/ORG_ADMIN may target any
   * registered school; everyone else is confined to their own tenant. */
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

  /** For acting on an *existing* item: SUPER_ADMIN/ORG_ADMIN may act on any
   * tenant; everyone else is confined to their own. */
  private assertCanAct(user: AuthUser, targetTenantId: string) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) return;
    if (targetTenantId !== currentTenant().tenantId) throw new NotFoundException("Inventory item not found");
  }

  async list(user: AuthUser, schoolId?: string, q?: string) {
    const scope = await this.readScope(user, schoolId);
    return this.prisma.inventoryItem.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        ...(scope.schoolId && { schoolId: scope.schoolId }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      },
      include: { school: { select: { name: true } } },
      orderBy: { submittedAt: "desc" },
      take: 200,
    });
  }

  async create(dto: CreateInventoryItemDto, user: AuthUser, actorId: string) {
    const tenantId = await this.resolveTenantForWrite(user, dto.schoolId);
    return this.prisma.inventoryItem.create({
      data: {
        tenantId, schoolId: dto.schoolId, name: dto.name, category: dto.category,
        description: dto.description, quantity: dto.quantity ?? 1, imageUrl: dto.imageUrl,
        ...(dto.submittedAt && { submittedAt: new Date(dto.submittedAt) }),
        remarks: dto.remarks, comments: dto.comments, createdBy: actorId,
      },
      include: { school: { select: { name: true } } },
    });
  }

  async update(id: string, dto: UpdateInventoryItemDto, user: AuthUser) {
    const existing = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Inventory item not found");
    this.assertCanAct(user, existing.tenantId);
    const tenantId = dto.schoolId ? await this.resolveTenantForWrite(user, dto.schoolId) : existing.tenantId;
    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(dto.schoolId !== undefined && { schoolId: dto.schoolId, tenantId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.submittedAt !== undefined && { submittedAt: new Date(dto.submittedAt) }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.comments !== undefined && { comments: dto.comments }),
      },
      include: { school: { select: { name: true } } },
    });
  }

  async remove(id: string, user: AuthUser) {
    const existing = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Inventory item not found");
    this.assertCanAct(user, existing.tenantId);
    await this.prisma.inventoryItem.delete({ where: { id } });
    return { deleted: true };
  }
}

@ApiTags("inventory-items")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("inventory-items")
export class InventoryItemController {
  constructor(private svc: InventoryItemService) {}

  @Get()
  @Roles(...MANAGE)
  list(@CurrentUser() user: AuthUser, @Query("schoolId") schoolId?: string, @Query("q") q?: string) {
    return this.svc.list(user, schoolId, q);
  }

  @Post()
  @Roles(...MANAGE)
  create(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user, user.id);
  }

  @Patch(":id")
  @Roles(...MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateInventoryItemDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }
}

@Module({ controllers: [InventoryItemController], providers: [InventoryItemService] })
export class InventoryItemModule {}
