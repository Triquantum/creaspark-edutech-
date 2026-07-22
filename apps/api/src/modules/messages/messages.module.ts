import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable,
  Module, NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { listViewableStudents } from "../../common/access/student-access";

export class SendMessageDto {
  @IsString() body: string;
  @IsOptional() @IsString() recipientId?: string;
  @IsOptional() @IsString() sectionId?: string;
}

const CAN_BROADCAST: Role[] = [Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR];

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

  sent(user: AuthUser) {
    const { tenantId } = currentTenant();
    return this.prisma.message.findMany({
      where: { tenantId, senderId: user.id },
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
}

@Module({ controllers: [MessagesController], providers: [MessagesService] })
export class MessagesModule {}
