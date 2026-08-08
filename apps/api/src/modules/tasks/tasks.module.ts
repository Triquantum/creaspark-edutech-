import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma, Role, TaskStatus } from "@educore/database";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateTaskDto {
  @IsString() subject: string;
  @IsOptional() @IsString() description?: string;
  @IsString() departmentId: string;
  @IsOptional() @IsDateString() targetDate?: string;
  @IsString() assignedToId: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsDateString() targetDate?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

export class QueryTasksDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

// Only admin-like roles create/assign/delete tasks; the assignee (any role)
// can still update their own task's status + remarks to report progress --
// see TasksService.update().
const MANAGE_ROLES = [
  Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR,
] as const;

const TASK_INCLUDE = {
  department: { select: { name: true } },
  assignedTo: { select: { id: true, fullName: true, role: true } },
  assignedBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
};

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private isManager(role: string): boolean {
    return (MANAGE_ROLES as readonly string[]).includes(role);
  }

  /** Not school-scoped -- SUPER_ADMIN/ORG_ADMIN act within their own
   * (placeholder) tenant here just like every other manage role, since
   * there's no school picker left to resolve a different tenant from. */
  private tenantId(): string {
    return currentTenant().tenantId;
  }

  /** List visibility: SUPER_ADMIN/ORG_ADMIN cross-tenant (every task,
   * platform-wide), other manage roles see every task in their own tenant,
   * everyone else only sees tasks they created or were assigned -- per the
   * "assigner, assignee, and admins" visibility rule this module was scoped
   * to. */
  async list(user: AuthUser, query: QueryTasksDto) {
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    const and: Prisma.TaskItemWhereInput[] = [];
    if (!crossTenant) and.push({ tenantId: this.tenantId() });
    if (query.departmentId) and.push({ departmentId: query.departmentId });
    if (query.status) and.push({ status: query.status });
    if (query.assignedToId) and.push({ assignedToId: query.assignedToId });
    if (!this.isManager(user.role)) and.push({ OR: [{ assignedToId: user.id }, { assignedById: user.id }] });
    if (query.q) {
      and.push({
        OR: [
          { subject: { contains: query.q, mode: "insensitive" as const } },
          { description: { contains: query.q, mode: "insensitive" as const } },
          { serialNo: { contains: query.q, mode: "insensitive" as const } },
        ],
      });
    }
    return this.prisma.taskItem.findMany({
      where: { AND: and },
      include: TASK_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  }

  /** Every active user -- for the Assigned To picker. Manage-roles only,
   * matching who's allowed to create tasks. SUPER_ADMIN/ORG_ADMIN see every
   * user platform-wide; everyone else sees their own tenant. */
  async staff(user: AuthUser) {
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    return this.prisma.user.findMany({
      where: { ...(!crossTenant && { tenantId: this.tenantId() }), isActive: true },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    });
  }

  /** Message-based notification to the assignee -- reuses the existing
   * Message/bell system (read-tracking, inbox, unread count) rather than a
   * separate notification type, same pattern as portion.module.ts's
   * notifyReviewers(). */
  private async notifyAssignee(tenantId: string, assignerId: string, assigneeId: string, task: { serialNo: string; subject: string }) {
    if (assigneeId === assignerId) return;
    await this.prisma.message.create({
      data: {
        tenantId, senderId: assignerId, recipientId: assigneeId,
        subject: "New task assigned",
        body: `You've been assigned task ${task.serialNo}: "${task.subject}".`,
      },
    });
  }

  async create(dto: CreateTaskDto, user: AuthUser) {
    const tenantId = this.tenantId();
    const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!dept || dept.tenantId !== tenantId) throw new NotFoundException("Department not found in your organization");
    const assignee = await this.prisma.user.findFirst({ where: { id: dto.assignedToId, tenantId } });
    if (!assignee) throw new NotFoundException("Assignee not found in this organization");
    const task = await this.prisma.taskItem.create({
      data: {
        tenantId, subject: dto.subject, description: dto.description,
        departmentId: dto.departmentId, targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        assignedToId: dto.assignedToId, assignedById: user.id, updatedById: user.id,
        remarks: dto.remarks, status: dto.status ?? TaskStatus.OPEN,
      },
      include: TASK_INCLUDE,
    });
    await this.notifyAssignee(tenantId, user.id, dto.assignedToId, task);
    return task;
  }

  private async findTask(id: string) {
    const task = await this.prisma.taskItem.findUnique({ where: { id } });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  /** Manage roles get a full edit; the assignee (anyone else) can only move
   * status and add remarks on their own task -- everything else they send
   * is silently ignored rather than rejected, so a stale client can't 403
   * a legitimate status update just for also sending an unrelated field. */
  async update(id: string, dto: UpdateTaskDto, user: AuthUser) {
    const task = await this.findTask(id);
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    const isManager = this.isManager(user.role) && (crossTenant || task.tenantId === this.tenantId());
    const isAssignee = task.assignedToId === user.id;
    if (!isManager && !isAssignee) throw new NotFoundException("Task not found");

    if (!isManager) {
      return this.prisma.taskItem.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks }),
          updatedById: user.id,
        },
        include: TASK_INCLUDE,
      });
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept || dept.tenantId !== task.tenantId) throw new NotFoundException("Department not found in your organization");
    }
    const reassigned = dto.assignedToId !== undefined && dto.assignedToId !== task.assignedToId;
    const updated = await this.prisma.taskItem.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.targetDate !== undefined && { targetDate: dto.targetDate ? new Date(dto.targetDate) : null }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.status !== undefined && { status: dto.status }),
        updatedById: user.id,
      },
      include: TASK_INCLUDE,
    });
    if (reassigned) await this.notifyAssignee(task.tenantId, user.id, dto.assignedToId!, updated);
    return updated;
  }

  async remove(id: string, user: AuthUser) {
    const task = await this.findTask(id);
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    if (!crossTenant && task.tenantId !== this.tenantId()) throw new NotFoundException("Task not found");
    await this.prisma.taskItem.delete({ where: { id } });
    return { deleted: true };
  }
}

@ApiTags("tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tasks")
export class TasksController {
  constructor(private svc: TasksService) {}

  @Get()
  list(@Query() query: QueryTasksDto, @CurrentUser() user: AuthUser) {
    return this.svc.list(user, query);
  }

  @Get("staff")
  @Roles(...MANAGE_ROLES)
  staff(@CurrentUser() user: AuthUser) {
    return this.svc.staff(user);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }
}

@Module({ controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
