import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Role, SalesActivityType, SalesFollowUpStatus, TaskStatus } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { TasksService } from "../tasks/tasks.module";
import {
  CheckInDto, CheckOutDto, CompleteFollowUpDto, ConvertLeadDto, CreateActivityDto, CreateFollowUpDto,
  CreateLeadDto, CreateOpportunityDto, CreateTargetDto, QueryActivitiesDto, QueryDateRangeDto,
  ReviewDailyReportDto, UpdateActivityDto, UpdateFollowUpDto, UpdateLeadDto, UpdateOpportunityDto,
  UpsertDailyReportDto,
} from "./sales.dto";

const MANAGE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SALES_MANAGER];

function isManager(user: AuthUser): boolean {
  return MANAGE_ROLES.includes(user.role as Role);
}
function isCrossTenant(user: AuthUser): boolean {
  return user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

const ACTIVITY_INCLUDE = {
  user: { select: { id: true, fullName: true } },
  school: { select: { id: true, name: true } },
  lead: { select: { id: true, schoolName: true } },
  opportunity: { select: { id: true, title: true } },
  generatedTask: { select: { id: true, serialNo: true } },
};

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService, private tasksService: TasksService) {}

  private async audit(user: AuthUser, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { tenantId: currentTenant().tenantId, userId: user.id, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  private scopeUserId(user: AuthUser, requestedUserId?: string): string | undefined {
    if (!isManager(user)) return user.id;
    return requestedUserId;
  }
  private tenantFilter(user: AuthUser) {
    return isCrossTenant(user) ? {} : { tenantId: currentTenant().tenantId };
  }

  private async assertCanActOnUser(user: AuthUser, targetUserId: string) {
    if (targetUserId === user.id) return;
    if (!isManager(user)) throw new NotFoundException("Not found");
  }

  // ────────────────────────── Activities ──────────────────────────

  async listActivities(user: AuthUser, query: QueryActivitiesDto) {
    const scopedUserId = this.scopeUserId(user, query.userId);
    const and: Prisma.SalesActivityWhereInput[] = [this.tenantFilter(user)];
    if (scopedUserId) and.push({ userId: scopedUserId });
    if (query.schoolId) and.push({ schoolId: query.schoolId });
    if (query.leadId) and.push({ leadId: query.leadId });
    if (query.opportunityId) and.push({ opportunityId: query.opportunityId });
    if (query.type) and.push({ type: query.type });
    if (query.dateFrom) and.push({ activityDate: { gte: new Date(query.dateFrom) } });
    if (query.dateTo) and.push({ activityDate: { lte: new Date(query.dateTo) } });
    return this.prisma.salesActivity.findMany({
      where: { AND: and }, include: ACTIVITY_INCLUDE, orderBy: { activityDate: "desc" }, take: 300,
    });
  }

  private async maybeCreateFollowUp(tx: Prisma.TransactionClient, activity: { id: string; tenantId: string; userId: string; schoolId: string | null; leadId: string | null; opportunityId: string | null; nextAction: string | null; nextFollowUpDate: Date | null }) {
    if (!activity.nextFollowUpDate || !activity.nextAction) return;
    await tx.salesFollowUp.create({
      data: {
        tenantId: activity.tenantId, userId: activity.userId, schoolId: activity.schoolId, leadId: activity.leadId,
        opportunityId: activity.opportunityId, sourceActivityId: activity.id, nextAction: activity.nextAction,
        dueDate: activity.nextFollowUpDate,
      },
    });
  }

  async createActivity(dto: CreateActivityDto, user: AuthUser) {
    const tenantId = currentTenant().tenantId;
    if (dto.schoolId && !(await this.prisma.school.findUnique({ where: { id: dto.schoolId } }))) throw new NotFoundException("School not found");
    if (dto.leadId && !(await this.prisma.salesLead.findUnique({ where: { id: dto.leadId } }))) throw new NotFoundException("Lead not found");
    if (dto.opportunityId && !(await this.prisma.salesOpportunity.findUnique({ where: { id: dto.opportunityId } }))) throw new NotFoundException("Opportunity not found");

    let generatedTaskId: string | undefined;
    if (dto.createTask && dto.nextAction) {
      const dept = await this.prisma.department.upsert({ where: { name: "Sales" }, update: {}, create: { name: "Sales" } });
      const task = await this.tasksService.create(
        { subject: dto.nextAction, departmentIds: [dept.id], assignedToIds: [user.id], targetDate: dto.nextFollowUpDate },
        user,
      );
      generatedTaskId = task.id;
    }

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.salesActivity.create({
        data: {
          tenantId, userId: user.id, type: dto.type, schoolId: dto.schoolId, leadId: dto.leadId, opportunityId: dto.opportunityId,
          contactPerson: dto.contactPerson, purpose: dto.purpose, description: dto.description, outcome: dto.outcome,
          activityDate: dto.activityDate ? new Date(dto.activityDate) : undefined,
          startTime: dto.startTime ? new Date(dto.startTime) : undefined, endTime: dto.endTime ? new Date(dto.endTime) : undefined,
          nextAction: dto.nextAction, nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined,
          priority: dto.priority, status: dto.status ?? TaskStatus.OPEN, generatedTaskId,
        },
        include: ACTIVITY_INCLUDE,
      });
      await this.maybeCreateFollowUp(tx, created);
      return created;
    });
    await this.audit(user, "sales.activity.create", "SalesActivity", activity.id, { type: dto.type, schoolId: dto.schoolId });
    return activity;
  }

  async updateActivity(id: string, dto: UpdateActivityDto, user: AuthUser) {
    const activity = await this.prisma.salesActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException("Activity not found");
    await this.assertCanActOnUser(user, activity.userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.salesActivity.update({
        where: { id },
        data: {
          ...(dto.outcome !== undefined && { outcome: dto.outcome }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.activityDate !== undefined && { activityDate: new Date(dto.activityDate) }),
          ...(dto.nextAction !== undefined && { nextAction: dto.nextAction }),
          ...(dto.nextFollowUpDate !== undefined && { nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : null }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        include: ACTIVITY_INCLUDE,
      });
      if (dto.nextFollowUpDate && dto.nextAction && !activity.nextFollowUpDate) {
        await this.maybeCreateFollowUp(tx, result);
      }
      return result;
    });
    await this.audit(user, "sales.activity.update", "SalesActivity", id, { ...dto });
    return updated;
  }

  async checkIn(id: string, dto: CheckInDto, user: AuthUser) {
    const activity = await this.prisma.salesActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException("Activity not found");
    await this.assertCanActOnUser(user, activity.userId);
    if (activity.checkInAt) throw new BadRequestException("Already checked in");
    return this.prisma.salesActivity.update({
      where: { id }, data: { checkInAt: new Date(), checkInLat: dto.lat, checkInLng: dto.lng }, include: ACTIVITY_INCLUDE,
    });
  }

  async checkOut(id: string, dto: CheckOutDto, user: AuthUser) {
    const activity = await this.prisma.salesActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException("Activity not found");
    await this.assertCanActOnUser(user, activity.userId);
    if (!activity.checkInAt) throw new BadRequestException("Not checked in yet");
    if (activity.checkOutAt) throw new BadRequestException("Already checked out");
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.salesActivity.update({
        where: { id },
        data: {
          checkOutAt: new Date(), checkOutLat: dto.lat, checkOutLng: dto.lng,
          ...(dto.outcome !== undefined && { outcome: dto.outcome }),
          ...(dto.nextAction !== undefined && { nextAction: dto.nextAction }),
          ...(dto.nextFollowUpDate !== undefined && { nextFollowUpDate: new Date(dto.nextFollowUpDate) }),
          status: TaskStatus.COMPLETED,
        },
        include: ACTIVITY_INCLUDE,
      });
      if (dto.nextFollowUpDate && dto.nextAction) await this.maybeCreateFollowUp(tx, result);
      return result;
    });
    return updated;
  }

  // ────────────────────────── My Day ──────────────────────────

  async myDay(user: AuthUser) {
    const today = new Date();
    const from = startOfDay(today), to = endOfDay(today);
    const activities = await this.prisma.salesActivity.findMany({
      where: { userId: user.id, activityDate: { gte: from, lte: to } },
      include: ACTIVITY_INCLUDE,
      orderBy: { activityDate: "asc" },
    });
    const followUps = await this.prisma.salesFollowUp.findMany({
      where: { userId: user.id, status: SalesFollowUpStatus.PENDING, dueDate: { gte: from, lte: to } },
    });
    const overdueCount = await this.prisma.salesFollowUp.count({
      where: { userId: user.id, status: SalesFollowUpStatus.PENDING, dueDate: { lt: from } },
    });
    const countByType = (t: SalesActivityType) => activities.filter((a) => a.type === t).length;
    return {
      totalTasks: activities.length,
      completed: activities.filter((a) => a.status === "COMPLETED").length,
      pending: activities.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length,
      overdue: overdueCount,
      calls: countByType("CALL"),
      visits: countByType("SCHOOL_VISIT") + countByType("CUSTOMER_VISIT"),
      meetings: countByType("MEETING") + countByType("ONLINE_MEETING"),
      followUps: followUps.length,
      newLeads: countByType("LEAD_CREATION"),
      timeline: activities,
    };
  }

  // ────────────────────────── Leads ──────────────────────────

  async listLeads(user: AuthUser, assignedToId?: string) {
    const scopedUserId = this.scopeUserId(user, assignedToId);
    return this.prisma.salesLead.findMany({
      where: { AND: [this.tenantFilter(user), ...(scopedUserId ? [{ assignedToId: scopedUserId }] : [])] },
      include: { assignedTo: { select: { fullName: true } }, convertedSchool: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  }

  async leadDetail(id: string, user: AuthUser) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { fullName: true } }, convertedSchool: { select: { id: true, name: true } },
        activities: { include: ACTIVITY_INCLUDE, orderBy: { activityDate: "desc" } },
        opportunities: true,
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");
    await this.assertCanActOnUser(user, lead.assignedToId);
    return lead;
  }

  async createLead(dto: CreateLeadDto, user: AuthUser) {
    const assignedToId = dto.assignedToId ?? user.id;
    if (assignedToId !== user.id) await this.assertCanActOnUser(user, assignedToId);
    const lead = await this.prisma.salesLead.create({
      data: { tenantId: currentTenant().tenantId, ...dto, assignedToId },
      include: { assignedTo: { select: { fullName: true } } },
    });
    await this.audit(user, "sales.lead.create", "SalesLead", lead.id, { schoolName: dto.schoolName });
    return lead;
  }

  async updateLead(id: string, dto: UpdateLeadDto, user: AuthUser) {
    const lead = await this.prisma.salesLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException("Lead not found");
    await this.assertCanActOnUser(user, lead.assignedToId);
    if (dto.assignedToId) await this.assertCanActOnUser(user, dto.assignedToId);
    const updated = await this.prisma.salesLead.update({ where: { id }, data: dto, include: { assignedTo: { select: { fullName: true } } } });
    await this.audit(user, "sales.lead.update", "SalesLead", id, { previousStatus: lead.status, ...dto } as Record<string, unknown>);
    return updated;
  }

  async convertLead(id: string, dto: ConvertLeadDto, user: AuthUser) {
    const lead = await this.prisma.salesLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException("Lead not found");
    await this.assertCanActOnUser(user, lead.assignedToId);
    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException("School not found");
    const updated = await this.prisma.salesLead.update({
      where: { id }, data: { status: "CONVERTED", convertedSchoolId: dto.schoolId },
    });
    await this.audit(user, "sales.lead.convert", "SalesLead", id, { schoolId: dto.schoolId });
    return updated;
  }

  // ────────────────────────── Follow-ups ──────────────────────────

  async listFollowUps(user: AuthUser, bucket: "today" | "upcoming" | "overdue" | "completed" | undefined, userId?: string) {
    const scopedUserId = this.scopeUserId(user, userId);
    const and: Prisma.SalesFollowUpWhereInput[] = [this.tenantFilter(user)];
    if (scopedUserId) and.push({ userId: scopedUserId });
    const now = new Date();
    if (bucket === "today") and.push({ status: "PENDING", dueDate: { gte: startOfDay(now), lte: endOfDay(now) } });
    else if (bucket === "upcoming") and.push({ status: "PENDING", dueDate: { gt: endOfDay(now) } });
    else if (bucket === "overdue") and.push({ status: "PENDING", dueDate: { lt: startOfDay(now) } });
    else if (bucket === "completed") and.push({ status: "COMPLETED" });
    return this.prisma.salesFollowUp.findMany({
      where: { AND: and },
      include: {
        user: { select: { fullName: true } }, school: { select: { id: true, name: true } },
        lead: { select: { id: true, schoolName: true } }, opportunity: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 300,
    });
  }

  async createFollowUp(dto: CreateFollowUpDto, user: AuthUser) {
    const assignedToId = dto.assignedToId ?? user.id;
    if (assignedToId !== user.id) await this.assertCanActOnUser(user, assignedToId);
    const followUp = await this.prisma.salesFollowUp.create({
      data: {
        tenantId: currentTenant().tenantId, userId: assignedToId, schoolId: dto.schoolId, leadId: dto.leadId,
        opportunityId: dto.opportunityId, nextAction: dto.nextAction, dueDate: new Date(dto.dueDate), priority: dto.priority,
      },
    });
    await this.audit(user, "sales.followup.create", "SalesFollowUp", followUp.id, { dueDate: dto.dueDate });
    return followUp;
  }

  async updateFollowUp(id: string, dto: UpdateFollowUpDto, user: AuthUser) {
    const followUp = await this.prisma.salesFollowUp.findUnique({ where: { id } });
    if (!followUp) throw new NotFoundException("Follow-up not found");
    await this.assertCanActOnUser(user, followUp.userId);
    return this.prisma.salesFollowUp.update({
      where: { id },
      data: {
        ...(dto.nextAction !== undefined && { nextAction: dto.nextAction }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async completeFollowUp(id: string, dto: CompleteFollowUpDto, user: AuthUser) {
    const followUp = await this.prisma.salesFollowUp.findUnique({ where: { id } });
    if (!followUp) throw new NotFoundException("Follow-up not found");
    await this.assertCanActOnUser(user, followUp.userId);
    if (followUp.status !== "PENDING") throw new BadRequestException("This follow-up is already resolved");

    const result = await this.prisma.$transaction(async (tx) => {
      let resultActivity = null;
      if (dto.resultActivityType) {
        resultActivity = await tx.salesActivity.create({
          data: {
            tenantId: followUp.tenantId, userId: followUp.userId, type: dto.resultActivityType,
            schoolId: followUp.schoolId, leadId: followUp.leadId, opportunityId: followUp.opportunityId,
            outcome: dto.outcome, description: `Follow-up: ${followUp.nextAction}`, status: TaskStatus.COMPLETED,
          },
        });
      }
      const updated = await tx.salesFollowUp.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date(), completedActivityId: resultActivity?.id },
      });
      return updated;
    });
    await this.audit(user, "sales.followup.complete", "SalesFollowUp", id, {});
    return result;
  }

  // ────────────────────────── Opportunities ──────────────────────────

  async listOpportunities(user: AuthUser, assignedToId?: string, stage?: string) {
    const scopedUserId = this.scopeUserId(user, assignedToId);
    const and: Prisma.SalesOpportunityWhereInput[] = [this.tenantFilter(user)];
    if (scopedUserId) and.push({ assignedToId: scopedUserId });
    if (stage) and.push({ stage: stage as never });
    return this.prisma.salesOpportunity.findMany({
      where: { AND: and },
      include: { assignedTo: { select: { fullName: true } }, school: { select: { id: true, name: true } }, lead: { select: { id: true, schoolName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });
  }

  async opportunityDetail(id: string, user: AuthUser) {
    const opportunity = await this.prisma.salesOpportunity.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { fullName: true } }, school: { select: { id: true, name: true } }, lead: { select: { id: true, schoolName: true } },
        activities: { include: ACTIVITY_INCLUDE, orderBy: { activityDate: "desc" } },
      },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
    await this.assertCanActOnUser(user, opportunity.assignedToId);
    return opportunity;
  }

  async createOpportunity(dto: CreateOpportunityDto, user: AuthUser) {
    const assignedToId = dto.assignedToId ?? user.id;
    if (assignedToId !== user.id) await this.assertCanActOnUser(user, assignedToId);
    const opportunity = await this.prisma.salesOpportunity.create({
      data: {
        tenantId: currentTenant().tenantId, title: dto.title, schoolId: dto.schoolId, leadId: dto.leadId,
        value: dto.value, probability: dto.probability, expectedClosingDate: dto.expectedClosingDate ? new Date(dto.expectedClosingDate) : undefined,
        nextAction: dto.nextAction, nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined, assignedToId,
      },
    });
    await this.audit(user, "sales.opportunity.create", "SalesOpportunity", opportunity.id, { title: dto.title });
    return opportunity;
  }

  async updateOpportunity(id: string, dto: UpdateOpportunityDto, user: AuthUser) {
    const opportunity = await this.prisma.salesOpportunity.findUnique({ where: { id } });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
    await this.assertCanActOnUser(user, opportunity.assignedToId);
    const updated = await this.prisma.salesOpportunity.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.stage !== undefined && { stage: dto.stage, ...(dto.stage === "WON" && { wonAt: new Date() }), ...(dto.stage === "LOST" && { lostAt: new Date() }) }),
        ...(dto.probability !== undefined && { probability: dto.probability }),
        ...(dto.expectedClosingDate !== undefined && { expectedClosingDate: new Date(dto.expectedClosingDate) }),
        ...(dto.nextAction !== undefined && { nextAction: dto.nextAction }),
        ...(dto.nextFollowUpDate !== undefined && { nextFollowUpDate: new Date(dto.nextFollowUpDate) }),
        ...(dto.lostReason !== undefined && { lostReason: dto.lostReason }),
      },
    });
    if (dto.stage && dto.stage !== opportunity.stage) {
      await this.audit(user, "sales.opportunity.stage_change", "SalesOpportunity", id, { from: opportunity.stage, to: dto.stage });
    }
    return updated;
  }

  // ────────────────────────── Daily Reports ──────────────────────────

  private async computeDayStats(userId: string, date: Date) {
    const from = startOfDay(date), to = endOfDay(date);
    const activities = await this.prisma.salesActivity.findMany({ where: { userId, activityDate: { gte: from, lte: to } } });
    const leads = await this.prisma.salesLead.count({ where: { assignedToId: userId, createdAt: { gte: from, lte: to } } });
    const proposals = activities.filter((a) => a.type === "PROPOSAL" || a.type === "QUOTATION").length;
    return {
      tasksPlanned: activities.length,
      tasksCompleted: activities.filter((a) => a.status === "COMPLETED").length,
      calls: activities.filter((a) => a.type === "CALL").length,
      visits: activities.filter((a) => a.type === "SCHOOL_VISIT" || a.type === "CUSTOMER_VISIT").length,
      meetings: activities.filter((a) => a.type === "MEETING" || a.type === "ONLINE_MEETING").length,
      demos: activities.filter((a) => a.type === "PRODUCT_DEMO").length,
      followUps: activities.filter((a) => a.type === "FOLLOW_UP").length,
      newLeads: leads,
      proposals,
    };
  }

  async todayReport(user: AuthUser) {
    const today = startOfDay(new Date());
    const stats = await this.computeDayStats(user.id, today);
    const existing = await this.prisma.salesDailyReport.findUnique({ where: { userId_reportDate: { userId: user.id, reportDate: today } } });
    return { ...stats, report: existing };
  }

  async upsertDailyReport(dto: UpsertDailyReportDto, user: AuthUser) {
    const today = startOfDay(new Date());
    const report = await this.prisma.salesDailyReport.upsert({
      where: { userId_reportDate: { userId: user.id, reportDate: today } },
      update: dto,
      create: { tenantId: currentTenant().tenantId, userId: user.id, reportDate: today, ...dto },
    });
    return report;
  }

  async submitDailyReport(id: string, user: AuthUser) {
    const report = await this.prisma.salesDailyReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Report not found");
    await this.assertCanActOnUser(user, report.userId);
    const updated = await this.prisma.salesDailyReport.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await this.audit(user, "sales.daily_report.submit", "SalesDailyReport", id, {});
    return updated;
  }

  async reviewDailyReport(id: string, dto: ReviewDailyReportDto, user: AuthUser) {
    if (!isManager(user)) throw new NotFoundException("Not found");
    const updated = await this.prisma.salesDailyReport.update({
      where: { id }, data: { status: "REVIEWED", managerComments: dto.managerComments, reviewedById: user.id, reviewedAt: new Date() },
    });
    await this.audit(user, "sales.daily_report.review", "SalesDailyReport", id, { comments: dto.managerComments });
    return updated;
  }

  async listDailyReports(user: AuthUser, query: QueryDateRangeDto) {
    const scopedUserId = this.scopeUserId(user, query.userId);
    const and: Prisma.SalesDailyReportWhereInput[] = [this.tenantFilter(user)];
    if (scopedUserId) and.push({ userId: scopedUserId });
    if (query.dateFrom) and.push({ reportDate: { gte: new Date(query.dateFrom) } });
    if (query.dateTo) and.push({ reportDate: { lte: new Date(query.dateTo) } });
    return this.prisma.salesDailyReport.findMany({
      where: { AND: and }, include: { user: { select: { fullName: true } }, reviewedBy: { select: { fullName: true } } },
      orderBy: { reportDate: "desc" }, take: 100,
    });
  }

  // ────────────────────────── Targets ──────────────────────────

  async listTargets(user: AuthUser) {
    return this.prisma.salesTarget.findMany({
      where: this.tenantFilter(user), include: { user: { select: { fullName: true } } }, orderBy: { periodStart: "desc" },
    });
  }

  async createTarget(dto: CreateTargetDto, user: AuthUser) {
    if (!isManager(user)) throw new NotFoundException("Not found");
    const target = await this.prisma.salesTarget.upsert({
      where: {
        userId_period_periodStart_metric: {
          userId: dto.userId ?? "", period: dto.period, periodStart: new Date(dto.periodStart), metric: dto.metric,
        },
      },
      update: { targetValue: dto.targetValue, periodEnd: new Date(dto.periodEnd) },
      create: {
        tenantId: currentTenant().tenantId, userId: dto.userId, period: dto.period, periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd), metric: dto.metric, targetValue: dto.targetValue, createdById: user.id,
      },
    });
    await this.audit(user, "sales.target.set", "SalesTarget", target.id, { ...dto });
    return target;
  }

  async achievement(user: AuthUser, targetUserId: string, periodStart: string, periodEnd: string) {
    await this.assertCanActOnUser(user, targetUserId);
    const from = new Date(periodStart), to = new Date(periodEnd);
    const targets = await this.prisma.salesTarget.findMany({ where: { userId: targetUserId, periodStart: { gte: from }, periodEnd: { lte: to } } });
    const activities = await this.prisma.salesActivity.findMany({ where: { userId: targetUserId, activityDate: { gte: from, lte: to } } });
    const opportunities = await this.prisma.salesOpportunity.findMany({ where: { assignedToId: targetUserId, wonAt: { gte: from, lte: to } } });
    const actuals: Record<string, number> = {
      CALLS: activities.filter((a) => a.type === "CALL").length,
      VISITS: activities.filter((a) => a.type === "SCHOOL_VISIT" || a.type === "CUSTOMER_VISIT").length,
      MEETINGS: activities.filter((a) => a.type === "MEETING" || a.type === "ONLINE_MEETING").length,
      LEADS: activities.filter((a) => a.type === "LEAD_CREATION").length,
      DEMOS: activities.filter((a) => a.type === "PRODUCT_DEMO").length,
      PROPOSALS: activities.filter((a) => a.type === "PROPOSAL" || a.type === "QUOTATION").length,
      CONVERSIONS: opportunities.length,
      REVENUE: opportunities.reduce((s, o) => s + Number(o.value ?? 0), 0),
    };
    return targets.map((t) => ({
      metric: t.metric, target: Number(t.targetValue), actual: actuals[t.metric] ?? 0,
      remaining: Math.max(0, Number(t.targetValue) - (actuals[t.metric] ?? 0)),
      achievementPct: Number(t.targetValue) > 0 ? Math.round(((actuals[t.metric] ?? 0) / Number(t.targetValue)) * 100) : 0,
    }));
  }

  // ────────────────────────── Manager Dashboard / Team Performance ──────────────────────────

  async dashboard(user: AuthUser) {
    if (!isManager(user)) throw new NotFoundException("Not found");
    const today = startOfDay(new Date());
    const salespeople = await this.prisma.user.findMany({ where: { ...this.tenantFilter(user), role: { in: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER] }, isActive: true }, select: { id: true } });
    const activitiesToday = await this.prisma.salesActivity.count({ where: { ...this.tenantFilter(user), activityDate: { gte: today } } });
    const activeTodayIds = await this.prisma.salesActivity.findMany({ where: { ...this.tenantFilter(user), activityDate: { gte: today } }, select: { userId: true }, distinct: ["userId"] });
    const tasksCompleted = await this.prisma.salesActivity.count({ where: { ...this.tenantFilter(user), activityDate: { gte: today }, status: "COMPLETED" } });
    const tasksPending = await this.prisma.salesActivity.count({ where: { ...this.tenantFilter(user), activityDate: { gte: today }, status: { in: ["OPEN", "IN_PROGRESS"] } } });
    const overdueFollowUps = await this.prisma.salesFollowUp.count({ where: { ...this.tenantFilter(user), status: "PENDING", dueDate: { lt: today } } });
    const openOpportunities = await this.prisma.salesOpportunity.findMany({ where: { ...this.tenantFilter(user), stage: { notIn: ["WON", "LOST"] } } });
    const wonThisMonth = await this.prisma.salesOpportunity.count({ where: { ...this.tenantFilter(user), stage: "WON", wonAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } });
    const lostThisMonth = await this.prisma.salesOpportunity.count({ where: { ...this.tenantFilter(user), stage: "LOST", lostAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } });
    const newLeadsToday = await this.prisma.salesLead.count({ where: { ...this.tenantFilter(user), createdAt: { gte: today } } });
    const callsToday = await this.prisma.salesActivity.count({ where: { ...this.tenantFilter(user), activityDate: { gte: today }, type: "CALL" } });
    const visitsToday = await this.prisma.salesActivity.count({ where: { ...this.tenantFilter(user), activityDate: { gte: today }, type: { in: ["SCHOOL_VISIT", "CUSTOMER_VISIT"] } } });
    const meetingsToday = await this.prisma.salesActivity.count({ where: { ...this.tenantFilter(user), activityDate: { gte: today }, type: { in: ["MEETING", "ONLINE_MEETING"] } } });
    const followUpsToday = await this.prisma.salesFollowUp.count({ where: { ...this.tenantFilter(user), status: "PENDING", dueDate: { gte: today, lte: endOfDay(new Date()) } } });
    const proposalsToday = await this.prisma.salesActivity.count({ where: { ...this.tenantFilter(user), activityDate: { gte: today }, type: { in: ["PROPOSAL", "QUOTATION"] } } });

    return {
      totalSalespeople: salespeople.length, activeToday: activeTodayIds.length, activitiesToday,
      tasksCompleted, tasksPending, overdueTasks: overdueFollowUps,
      calls: callsToday, visits: visitsToday, meetings: meetingsToday, newLeads: newLeadsToday,
      followUps: followUpsToday, proposals: proposalsToday,
      openOpportunities: openOpportunities.length, pipelineValue: openOpportunities.reduce((s, o) => s + Number(o.value ?? 0), 0),
      wonDeals: wonThisMonth, lostDeals: lostThisMonth,
    };
  }

  async teamPerformance(user: AuthUser, dateFrom?: string, dateTo?: string) {
    if (!isManager(user)) throw new NotFoundException("Not found");
    const from = dateFrom ? new Date(dateFrom) : startOfDay(new Date());
    const to = dateTo ? new Date(dateTo) : endOfDay(new Date());
    const salespeople = await this.prisma.user.findMany({
      where: { ...this.tenantFilter(user), role: { in: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER] }, isActive: true },
      select: { id: true, fullName: true },
    });
    const rows = await Promise.all(salespeople.map(async (sp) => {
      const activities = await this.prisma.salesActivity.findMany({ where: { userId: sp.id, activityDate: { gte: from, lte: to } } });
      const leads = await this.prisma.salesLead.count({ where: { assignedToId: sp.id, createdAt: { gte: from, lte: to } } });
      const won = await this.prisma.salesOpportunity.findMany({ where: { assignedToId: sp.id, stage: "WON", wonAt: { gte: from, lte: to } } });
      const lost = await this.prisma.salesOpportunity.count({ where: { assignedToId: sp.id, stage: "LOST", lostAt: { gte: from, lte: to } } });
      return {
        id: sp.id, name: sp.fullName, tasks: activities.length, completed: activities.filter((a) => a.status === "COMPLETED").length,
        calls: activities.filter((a) => a.type === "CALL").length,
        visits: activities.filter((a) => a.type === "SCHOOL_VISIT" || a.type === "CUSTOMER_VISIT").length,
        meetings: activities.filter((a) => a.type === "MEETING" || a.type === "ONLINE_MEETING").length,
        leads, proposals: activities.filter((a) => a.type === "PROPOSAL" || a.type === "QUOTATION").length,
        won: won.length, lost, revenue: won.reduce((s, o) => s + Number(o.value ?? 0), 0),
      };
    }));
    return rows;
  }

  async salespersonDetail(userId: string, user: AuthUser) {
    await this.assertCanActOnUser(user, userId);
    const profile = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, email: true, phone: true, role: true } });
    if (!profile) throw new NotFoundException("User not found");
    const today = startOfDay(new Date());
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayStats, weekActivities, monthActivities, activities, dailyReports] = await Promise.all([
      this.computeDayStats(userId, today),
      this.prisma.salesActivity.count({ where: { userId, activityDate: { gte: weekStart } } }),
      this.prisma.salesActivity.count({ where: { userId, activityDate: { gte: monthStart } } }),
      this.prisma.salesActivity.findMany({ where: { userId }, include: ACTIVITY_INCLUDE, orderBy: { activityDate: "desc" }, take: 100 }),
      this.prisma.salesDailyReport.findMany({ where: { userId }, orderBy: { reportDate: "desc" }, take: 30 }),
    ]);
    return { profile, todayStats, weekActivityCount: weekActivities, monthActivityCount: monthActivities, activities, dailyReports };
  }

  // ────────────────────────── School activity history ──────────────────────────

  async schoolActivityHistory(schoolId: string, user: AuthUser) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, code: true } });
    if (!school) throw new NotFoundException("School not found");
    const [activities, leads, opportunities] = await Promise.all([
      this.prisma.salesActivity.findMany({ where: { schoolId }, include: ACTIVITY_INCLUDE, orderBy: { activityDate: "desc" } }),
      this.prisma.salesLead.findMany({ where: { convertedSchoolId: schoolId } }),
      this.prisma.salesOpportunity.findMany({ where: { schoolId }, include: { assignedTo: { select: { fullName: true } } } }),
    ]);
    return { school, activities, leads, opportunities };
  }
}
