import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable,
  Module, NotFoundException, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma, Role } from "@educore/database";
import { ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { listViewableStudents } from "../../common/access/student-access";

export class SendMessageDto {
  @IsString() body: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() recipientId?: string;
  @IsOptional() @IsString() sectionId?: string;
}

/** Cross-tenant announcement from Super Admin to a chosen school's staff.
 * Super Admin has no tenant of their own, so schoolId resolves the target
 * tenant the same way resolveTenant() does elsewhere in the app. */
export class SuperAdminBroadcastDto {
  @IsString() schoolId: string;
  @IsOptional() @IsString() subject?: string;
  @IsString() body: string;
  @IsArray() @ArrayNotEmpty() @IsEnum(Role, { each: true }) roles: Role[];
}

/** Search + filter params shared by inbox()/sent(). schoolId matches the
 * OTHER party's school regardless of how they're linked to one — staff via
 * StaffProfile, students directly, parents via their linked student. */
export class QueryMessagesDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

const CAN_BROADCAST: Role[] = [Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR];
const SUPER_ADMIN_BROADCAST_AUDIENCE: Role[] = [Role.TEACHER, Role.SCHOOL_ADMIN];

const PERSON = {
  select: { id: true, fullName: true, role: true, avatarUrl: true },
};

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  /** Matches a message's counterpart (sender or recipient) by role and/or
   * school. A person's "school" isn't a single column — staff have one via
   * StaffProfile, students directly, parents only via a linked student —
   * so this ORs across all three link paths rather than assuming one. */
  private personFilter(role?: Role, schoolId?: string): Prisma.UserWhereInput | undefined {
    if (!role && !schoolId) return undefined;
    return {
      ...(role && { role }),
      ...(schoolId && {
        OR: [
          { staffProfile: { schoolId } },
          { studentLink: { schoolId } },
          { guardianLinks: { some: { student: { schoolId } } } },
        ],
      }),
    };
  }

  async send(dto: SendMessageDto, user: AuthUser) {
    if (!dto.recipientId === !dto.sectionId) {
      throw new BadRequestException("Provide exactly one of recipientId or sectionId");
    }

    /** Super Admin's own tenantId is a placeholder unrelated to any real
     * school — a message they send must be stamped with the OTHER party's
     * real tenantId, or it'd never surface in that party's own
     * tenant-scoped inbox (same bug class already fixed on inbox()/sent()).
     * Every other role's own tenantId already IS the real school shared
     * with anyone they can message, so scoping the lookup by it and
     * reading tenantId back off the found row is equivalent — one code
     * path covers every role. */
    const ownScope = user.role === Role.SUPER_ADMIN ? {} : { tenantId: currentTenant().tenantId };
    let tenantId: string;

    if (dto.sectionId) {
      if (!CAN_BROADCAST.includes(user.role as Role)) {
        throw new ForbiddenException("Only staff can broadcast to a class");
      }
      const section = await this.prisma.section.findFirst({ where: { id: dto.sectionId, ...ownScope } });
      if (!section) throw new NotFoundException("Section not found");
      tenantId = section.tenantId;
    } else {
      const recipient = await this.prisma.user.findFirst({ where: { id: dto.recipientId, ...ownScope } });
      if (!recipient) throw new NotFoundException("Recipient not found");
      tenantId = recipient.tenantId;
    }

    return this.prisma.message.create({
      data: {
        tenantId, senderId: user.id, subject: dto.subject, body: dto.body,
        recipientId: dto.recipientId, sectionId: dto.sectionId,
      },
      include: { sender: PERSON, recipient: PERSON, section: { select: { id: true, name: true, class: { select: { name: true } } } } },
    });
  }

  private searchConditions(query: QueryMessagesDto): Prisma.MessageWhereInput[] {
    const conditions: Prisma.MessageWhereInput[] = [];
    if (query.q) {
      conditions.push({
        OR: [
          { subject: { contains: query.q, mode: "insensitive" } },
          { body: { contains: query.q, mode: "insensitive" } },
          { sender: { fullName: { contains: query.q, mode: "insensitive" } } },
          { recipient: { fullName: { contains: query.q, mode: "insensitive" } } },
        ],
      });
    }
    if (query.dateFrom) conditions.push({ createdAt: { gte: new Date(query.dateFrom) } });
    if (query.dateTo) conditions.push({ createdAt: { lte: new Date(query.dateTo) } });
    return conditions;
  }

  /** Direct messages to me, plus (for STUDENT/PARENT) broadcasts to my child's
   * section. Same cross-tenant fix as sent(): Super Admin's notifications
   * (e.g. portion-status alerts) land in the sending teacher's tenant, not
   * Super Admin's own placeholder one — currentTenant() would hide every
   * one of them, so Super Admin reads by recipientId alone, across every
   * tenant. */
  async inbox(user: AuthUser, query: QueryMessagesDto) {
    const scope = user.role === Role.SUPER_ADMIN ? {} : { tenantId: currentTenant().tenantId };
    const mySectionIds = new Set<string>();
    if (user.role === "STUDENT" || user.role === "PARENT") {
      const students = await listViewableStudents(this.prisma, user);
      const sections = await this.prisma.student.findMany({
        where: { id: { in: students.map((s) => s.id) }, sectionId: { not: null } },
        select: { sectionId: true },
      });
      sections.forEach((s) => s.sectionId && mySectionIds.add(s.sectionId));
    }

    const senderFilter = this.personFilter(query.role, query.schoolId);
    return this.prisma.message.findMany({
      where: {
        ...scope,
        AND: [
          { OR: [{ recipientId: user.id }, ...(mySectionIds.size ? [{ sectionId: { in: [...mySectionIds] } }] : [])] },
          ...(senderFilter ? [{ sender: senderFilter }] : []),
          ...this.searchConditions(query),
        ],
      },
      include: { sender: PERSON, section: { select: { id: true, name: true, class: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /** Super Admin's broadcasts land in each target school's tenant, not their
   * own placeholder tenant — currentTenant() would hide every one of them,
   * so Super Admin reads by senderId alone, across every tenant. */
  sent(user: AuthUser, query: QueryMessagesDto) {
    const scope = user.role === Role.SUPER_ADMIN ? {} : { tenantId: currentTenant().tenantId };
    const recipientFilter = this.personFilter(query.role, query.schoolId);
    return this.prisma.message.findMany({
      where: {
        ...scope, senderId: user.id,
        AND: [
          ...(recipientFilter ? [{ recipient: recipientFilter }] : []),
          ...this.searchConditions(query),
        ],
      },
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

  /** Only the sender (or Super Admin) can delete — recipients can't erase a
   * message someone else sent them. Deleting removes it for both sides;
   * there's no per-user soft-delete concept in this schema. */
  async remove(id: string, user: AuthUser) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException("Message not found");
    if (message.senderId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Only the sender can delete this message");
    }
    await this.prisma.message.delete({ where: { id } });
    return { deleted: true };
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
      data: recipients.map((r) => ({
        tenantId: school.tenantId, senderId: user.id, recipientId: r.id, subject: dto.subject, body: dto.body,
      })),
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
  inbox(@CurrentUser() user: AuthUser, @Query() query: QueryMessagesDto) {
    return this.svc.inbox(user, query);
  }

  @Get("sent")
  sent(@CurrentUser() user: AuthUser, @Query() query: QueryMessagesDto) {
    return this.svc.sent(user, query);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.markRead(id, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }

  @Post("broadcast")
  @Roles(Role.SUPER_ADMIN)
  broadcast(@Body() dto: SuperAdminBroadcastDto, @CurrentUser() user: AuthUser) {
    return this.svc.broadcastFromSuperAdmin(dto, user);
  }
}

@Module({ controllers: [MessagesController], providers: [MessagesService] })
export class MessagesModule {}
