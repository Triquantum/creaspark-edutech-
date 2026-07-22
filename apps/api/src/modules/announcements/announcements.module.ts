import { Body, Controller, Get, Module, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async list(role: Role, userId: string) {
    const { tenantId } = currentTenant();
    const rows = await this.prisma.announcement.findMany({
      where: { tenantId, audience: { has: role } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: { reads: { where: { userId }, select: { id: true } } },
    });
    return rows.map(({ reads, ...a }) => ({ ...a, isRead: reads.length > 0 }));
  }

  create(data: { schoolId: string; title: string; body: string; audience: Role[] }, userId: string) {
    const { tenantId } = currentTenant();
    return this.prisma.announcement.create({ data: { ...data, tenantId, createdBy: userId } });
  }

  async markRead(id: string, userId: string) {
    const { tenantId } = currentTenant();
    const announcement = await this.prisma.announcement.findFirst({ where: { id, tenantId } });
    if (!announcement) throw new NotFoundException("Announcement not found");
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      update: {},
      create: { tenantId, announcementId: id, userId },
    });
    return { read: true };
  }
}

@ApiTags("announcements")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("announcements")
export class AnnouncementsController {
  constructor(private svc: AnnouncementsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.role as Role, user.id);
  }

  @Post()
  @Roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR)
  create(
    @Body() body: { schoolId: string; title: string; body: string; audience: Role[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.create(body, user.id);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.markRead(id, user.id);
  }
}

@Module({ controllers: [AnnouncementsController], providers: [AnnouncementsService] })
export class AnnouncementsModule {}
