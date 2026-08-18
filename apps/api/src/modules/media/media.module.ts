import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MediaType, Role } from "@educore/database";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateMediaDto {
  @IsString() schoolId: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(MediaType) type: MediaType;
  @IsString() url: string;
}

export class UpdateMediaDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
}

// Upload/edit/delete: Super Admin, Org Admin, School Admin, Teacher.
const MANAGE = [
  Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR,
  Role.TEACHER, Role.ACADEMIC_ADMIN,
] as const;
// View: everyone above, plus Parent and Student.
const READ = [...MANAGE, Role.PARENT, Role.STUDENT] as const;

@Injectable()
export class MediaService {
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

  /** For uploading: SUPER_ADMIN/ORG_ADMIN may target any registered school;
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

  /** For acting on an *existing* item: SUPER_ADMIN/ORG_ADMIN may act on any
   * tenant; everyone else is confined to their own. */
  private assertCanAct(user: AuthUser, targetTenantId: string) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) return;
    if (targetTenantId !== currentTenant().tenantId) throw new NotFoundException("Media item not found");
  }

  async list(user: AuthUser, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    return this.prisma.mediaItem.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        ...(scope.schoolId && { schoolId: scope.schoolId }),
      },
      include: { school: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async create(dto: CreateMediaDto, user: AuthUser, actorId: string) {
    const tenantId = await this.resolveTenantForWrite(user, dto.schoolId);
    return this.prisma.mediaItem.create({
      data: {
        tenantId, schoolId: dto.schoolId, title: dto.title, description: dto.description,
        type: dto.type, url: dto.url, uploadedBy: actorId,
      },
      include: { school: { select: { name: true } } },
    });
  }

  async update(id: string, dto: UpdateMediaDto, user: AuthUser) {
    const existing = await this.prisma.mediaItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Media item not found");
    this.assertCanAct(user, existing.tenantId);
    return this.prisma.mediaItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { school: { select: { name: true } } },
    });
  }

  async remove(id: string, user: AuthUser) {
    const existing = await this.prisma.mediaItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Media item not found");
    this.assertCanAct(user, existing.tenantId);
    await this.prisma.mediaItem.delete({ where: { id } });
    return { deleted: true };
  }
}

@ApiTags("media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("media")
export class MediaController {
  constructor(private svc: MediaService) {}

  @Get()
  @Roles(...READ)
  list(@CurrentUser() user: AuthUser, @Query("schoolId") schoolId?: string) {
    return this.svc.list(user, schoolId);
  }

  @Post()
  @Roles(...MANAGE)
  create(@Body() dto: CreateMediaDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user, user.id);
  }

  @Patch(":id")
  @Roles(...MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateMediaDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }
}

@Module({ controllers: [MediaController], providers: [MediaService] })
export class MediaModule {}
