import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { Prisma, Role, TaskStatus } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateTaskDto {
  @IsString() subject: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) departmentIds: string[];
  @IsOptional() @IsDateString() targetDate?: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) assignedToIds: string[];
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) departmentIds?: string[];
  @IsOptional() @IsDateString() targetDate?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) assignedToIds?: string[];
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

const NON_STAFF_ROLES: Role[] = [Role.STUDENT, Role.PARENT, Role.GUEST];

const TASK_INCLUDE = {
  departments: { select: { department: { select: { id: true, name: true } } } },
  assignees: { select: { user: { select: { id: true, fullName: true, role: true } } } },
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

  /** Every active staff member (excludes Student/Parent/Guest) -- for the
   * Assigned To picker. Manage-roles only, matching who's allowed to
   * create tasks. SUPER_ADMIN/ORG_ADMIN see every school platform-wide
   * unless narrowed to one via schoolId; everyone else is confined to
   * their own tenant regardless of schoolId. */
  async staff(user: AuthUser, schoolId?: string) {
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    return this.prisma.user.findMany({
      where: {
        ...(!crossTenant && { tenantId: this.tenantId() }),
        role: { notIn: NON_STAFF_ROLES },
        isActive: true,
        ...(schoolId && { staffProfile: { schoolId } }),
      },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    });
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
    if (query.departmentId) and.push({ departments: { some: { departmentId: query.departmentId } } });
    if (query.status) and.push({ status: query.status });
    if (query.assignedToId) and.push({ assignees: { some: { userId: query.assignedToId } } });
    if (!this.isManager(user.role)) {
      and.push({ OR: [{ assignees: { some: { userId: user.id } } }, { assignedById: user.id }] });
    }
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

  /** Message-based notification to each assignee -- reuses the existing
   * Message/bell system (read-tracking, inbox, unread count) rather than a
   * separate notification type, same pattern as portion.module.ts's
   * notifyReviewers(). */
  private async notifyAssignees(tenantId: string, assignerId: string, assigneeIds: string[], task: { serialNo: string; subject: string }) {
    const recipients = assigneeIds.filter((id) => id !== assignerId);
    if (!recipients.length) return;
    await this.prisma.message.createMany({
      data: recipients.map((recipientId) => ({
        tenantId, senderId: assignerId, recipientId,
        subject: "New task assigned",
        body: `You've been assigned task ${task.serialNo}: "${task.subject}".`,
      })),
    });
  }

  /** Department is a global catalog (no tenant ownership), so this is
   * purely an existence check -- any staff-facing role can point a task at
   * any department. */
  private async validateDepartments(departmentIds: string[]) {
    const unique = [...new Set(departmentIds)];
    const rows = await this.prisma.department.findMany({ where: { id: { in: unique } } });
    if (rows.length !== unique.length) throw new NotFoundException("One or more departments no longer exist");
    return unique;
  }

  private async validateAssignees(tenantId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    const rows = await this.prisma.user.findMany({ where: { id: { in: unique }, tenantId } });
    if (rows.length !== unique.length) throw new NotFoundException("One or more assignees not found in this organization");
    return unique;
  }

  async create(dto: CreateTaskDto, user: AuthUser) {
    const tenantId = this.tenantId();
    const departmentIds = await this.validateDepartments(dto.departmentIds);
    const assigneeIds = await this.validateAssignees(tenantId, dto.assignedToIds);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskItem.create({
        data: {
          tenantId, subject: dto.subject, description: dto.description,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
          assignedById: user.id, updatedById: user.id,
          remarks: dto.remarks, status: dto.status ?? TaskStatus.OPEN,
        },
      });
      await tx.taskDepartment.createMany({ data: departmentIds.map((departmentId) => ({ taskId: created.id, departmentId })) });
      await tx.taskAssignee.createMany({ data: assigneeIds.map((userId) => ({ taskId: created.id, userId })) });
      return tx.taskItem.findUniqueOrThrow({ where: { id: created.id }, include: TASK_INCLUDE });
    });
    await this.notifyAssignees(tenantId, user.id, assigneeIds, task);
    return task;
  }

  private async findTask(id: string) {
    const task = await this.prisma.taskItem.findUnique({ where: { id }, include: { assignees: { select: { userId: true } } } });
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
    const isAssignee = task.assignees.some((a) => a.userId === user.id);
    if (!isManager && !isAssignee) throw new NotFoundException("Task not found");

    if (!isManager) {
      const updated = await this.prisma.taskItem.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks }),
          updatedById: user.id,
        },
        include: TASK_INCLUDE,
      });
      return updated;
    }

    const departmentIds = dto.departmentIds ? await this.validateDepartments(dto.departmentIds) : undefined;
    const assigneeIds = dto.assignedToIds ? await this.validateAssignees(task.tenantId, dto.assignedToIds) : undefined;
    const priorAssigneeIds = new Set(task.assignees.map((a) => a.userId));
    const newlyAdded = assigneeIds?.filter((uid) => !priorAssigneeIds.has(uid)) ?? [];

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.taskItem.update({
        where: { id },
        data: {
          ...(dto.subject !== undefined && { subject: dto.subject }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.targetDate !== undefined && { targetDate: dto.targetDate ? new Date(dto.targetDate) : null }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedById: user.id,
        },
      });
      if (departmentIds) {
        await tx.taskDepartment.deleteMany({ where: { taskId: id } });
        await tx.taskDepartment.createMany({ data: departmentIds.map((departmentId) => ({ taskId: id, departmentId })) });
      }
      if (assigneeIds) {
        await tx.taskAssignee.deleteMany({ where: { taskId: id } });
        await tx.taskAssignee.createMany({ data: assigneeIds.map((userId) => ({ taskId: id, userId })) });
      }
      return tx.taskItem.findUniqueOrThrow({ where: { id }, include: TASK_INCLUDE });
    });
    if (newlyAdded.length) await this.notifyAssignees(task.tenantId, user.id, newlyAdded, updated);
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
  staff(@CurrentUser() user: AuthUser, @Query("schoolId") schoolId?: string) {
    return this.svc.staff(user, schoolId);
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
