import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { HomepageMediaSection, MediaType, Role } from "@educore/database";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateHomepageMediaDto {
  @IsEnum(HomepageMediaSection) section: HomepageMediaSection;
  @IsEnum(MediaType) type: MediaType;
  @IsOptional() @IsString() title?: string;
  @IsString() url: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateHomepageMediaDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

@Injectable()
export class HomepageMediaService {
  constructor(private prisma: PrismaService) {}

  async list(section?: HomepageMediaSection) {
    return this.prisma.homepageMedia.findMany({
      where: section ? { section } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async create(dto: CreateHomepageMediaDto, actorId: string) {
    return this.prisma.homepageMedia.create({
      data: {
        section: dto.section, type: dto.type, title: dto.title,
        url: dto.url, sortOrder: dto.sortOrder ?? 0, uploadedBy: actorId,
      },
    });
  }

  async update(id: string, dto: UpdateHomepageMediaDto) {
    const existing = await this.prisma.homepageMedia.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Homepage media item not found");
    return this.prisma.homepageMedia.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.homepageMedia.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Homepage media item not found");
    await this.prisma.homepageMedia.delete({ where: { id } });
    return { deleted: true };
  }
}

// Admin management: Super Admin only -- this is public marketing-site content,
// not a school's own data, so no school/org admin gets write access here.
@ApiTags("homepage-media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("homepage-media")
export class HomepageMediaController {
  constructor(private svc: HomepageMediaService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  list(@Query("section") section?: HomepageMediaSection) {
    return this.svc.list(section);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateHomepageMediaDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user.id);
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateHomepageMediaDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN)
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}

// Public, unauthenticated: the marketing site calls this with no session and
// no X-Tenant header, so TenantMiddleware treats it as an unscoped route.
@ApiTags("public")
@Controller("public/homepage-media")
export class PublicHomepageMediaController {
  constructor(private svc: HomepageMediaService) {}

  @Get()
  list(@Query("section") section?: HomepageMediaSection) {
    return this.svc.list(section);
  }
}

@Module({
  controllers: [HomepageMediaController, PublicHomepageMediaController],
  providers: [HomepageMediaService],
})
export class HomepageMediaModule {}
