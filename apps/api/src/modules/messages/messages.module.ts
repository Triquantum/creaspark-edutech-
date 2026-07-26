import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable,
  Module, NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { listViewableStudents } from "../../common/access/student-access";

export class SendMessageDto {
  @IsString() body: string;
  @IsOptional() @IsString() recipientId?: string;
  @IsOptional() @IsString() sectionId?: string;
}

/** Cross-tenant announcement from Super Admin to a chosen school's staff.
 * Super Admin has no tenant of their own, so schoolId resolves the target
 * tenant the same way resolveTenant() does elsewhere in the app. */
export class SuperAdminBroadcastDto {
  @IsString() schoolId: string;
  @IsString() body: string;
  @IsArray() @ArrayNotEmpty() @IsEnum(Role, { each: true }) roles: Role[];
}

const CAN_BROADCAST: Role[] = [Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR];
const SUPER_ADMIN_BROADCAST_AUDIENCE: Role[] = [Role.TEACHER, Role.SCHOOL_ADMIN];

const PERSON = {
  select: { id: true, fullName: true, role: true, avatarUrl: true },
};

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async send(dto: SendMessageDto, user: AuthUser) {
    const { tenantId } = currentTenant();
    if (!dto.recipientId === !dto.sectionId) {
      throw new BadRequestException("Provide exactly one of recipientId or sectionId");
    }

    if (dto.sectionId) {
      if (!CAN_BROADCAST.includes(user.role as Role)) {
        throw new ForbiddenException("Only staff can broadcast to a class");
      }
      const section = await this.prisma.section.findFirst({ where: { id: dto.sectionId, tenantId } });
      if (!section) throw new NotFoundException("Section not found");
    } else {
      const recipient = await this.prisma.user.findFirst({ where: { id: dto.recipientId, tenantId } });
      if (!recipient) throw new NotFoundException("Recipient not found");
    }

    return this.prisma.message.create({
      data: {
        tenantId, senderId: user.id, body: dto.body,
        recipientId: dto.recipientId, sectionId: dto.sectionId,
      },
      include: { sender: PERSON, recipient: PERSON, section: { select: { id: true, name: true, class: { select: { name: true } } } } },
    });
  }

  /** Direct messages to me, plus (for STUDENT/PARENT) broadcasts to my child's section. */
  async inbox(user: AuthUser) {
    const { tenantId } = currentTenant();
    const mySectionIds = new Set<string>();
    if (user.role === "STUDENT" || user.role === "PARENT") {
      const students = await listViewableStudents(this.prisma, user);
      const sections = await this.prisma.student.findMany({
        where: { id: { in: students.map((s) => s.id) }, sectionId: { not: null } },
        select: { sectionId: true },
      });
      sections.forEach((s) => s.sectionId && mySectionIds.add(s.sectionId));
    }

    return this.prisma.message.findMany({
      where: {
        tenantId,
        OR: [{ recipientId: user.id }, ...(mySectionIds.size ? [{ sectionId: { in: [...mySectionIds] } }] : [])],
      },
      include: { sender: PERSON, section: { select: { id: true, name: true, class: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /** Super Admin's broadcasts land in each target school's tenant, not their
   * own placeholder tenant — currentTenant() would hide every one of them,
   * so Super Admin reads by senderId alone, across every tenant. */
  sent(user: AuthUser) {
    const scope = user.role === Role.SUPER_ADMIN ? {} : { tenantId: currentTenant().tenantId };
    return this.prisma.message.findMany({
      where: { ...scope, senderId: user.id },
      include: { recipient: PERSON, section: { select: { id: true, name: true, class: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(id: string, user: AuthUser) {
    const { tenantId } = currentTenant();
    const message = await this.prisma.message.findFirst({ where: { id, tenantId, recipientId: user.id } });
    if (!message) throw new NotFoundException("Message not found");
    return this.prisma.message.update({ where: { id }, data: { readAt: new Date() } });
  }

  /** Super Admin has no tenant of their own, so this bypasses currentTenant()
   * and resolves the target tenant from an explicit schoolId — same pattern
   * as resolveTenant() in students/users/teachers services. */
  async broadcastFromSuperAdmin(dto: SuperAdminBroadcastDto, user: AuthUser) {
    const invalidRoles = dto.roles.filter((r) => !SUPER_ADMIN_BROADCAST_AUDIENCE.includes(r));
    if (invalidRoles.length) {
      throw new BadRequestException(`Unsupported audience role(s): ${invalidRoles.join(", ")}`);
    }

    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId }, select: { id: true, name: true, tenantId: true },
    });
    if (!school) throw new NotFoundException("School not found");

    const recipients = await this.prisma.user.findMany({
      where: { tenantId: school.tenantId, role: { in: dto.roles }, isActive: true },
      select: { id: true },
    });
    if (!recipients.length) throw new BadRequestException("No active users with the selected role(s) at this school");

    await this.prisma.message.createMany({
      data: recipients.map((r) => ({ tenantId: school.tenantId, senderId: user.id, recipientId: r.id, body: dto.body })),
    });

    return { sentCount: recipients.length, school: school.name };
  }
}

@ApiTags("messages")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("messages")
export class MessagesController {
  constructor(private svc: MessagesService) {}

  @Post()
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return this.svc.send(dto, user);
  }

  @Get("inbox")
  inbox(@CurrentUser() user: AuthUser) {
    return this.svc.inbox(user);
  }

  @Get("sent")
  sent(@CurrentUser() user: AuthUser) {
    return this.svc.sent(user);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.markRead(id, user);
  }

  @Post("broadcast")
  @Roles(Role.SUPER_ADMIN)
  broadcast(@Body() dto: SuperAdminBroadcastDto, @CurrentUser() user: AuthUser) {
    return this.svc.broadcastFromSuperAdmin(dto, user);
  }
}

@Module({ controllers: [MessagesController], providers: [MessagesService] })
export class MessagesModule {}
