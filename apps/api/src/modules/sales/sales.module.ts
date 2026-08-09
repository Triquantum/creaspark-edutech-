import { Body, Controller, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { TasksModule } from "../tasks/tasks.module";
import { SalesService } from "./sales.service";
import {
  CheckInDto, CheckOutDto, CompleteFollowUpDto, ConvertLeadDto, CreateActivityDto, CreateFollowUpDto,
  CreateLeadDto, CreateOpportunityDto, CreateTargetDto, QueryActivitiesDto, QueryDateRangeDto,
  ReviewDailyReportDto, UpdateActivityDto, UpdateFollowUpDto, UpdateLeadDto, UpdateOpportunityDto,
  UpsertDailyReportDto,
} from "./sales.dto";

const SALES = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE] as const;
const MANAGE = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SALES_MANAGER] as const;

@ApiTags("sales-my-day") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/my-day")
export class SalesMyDayController {
  constructor(private svc: SalesService) {}
  @Get() myDay(@CurrentUser() user: AuthUser) { return this.svc.myDay(user); }
}

@ApiTags("sales-activities") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/activities")
export class SalesActivitiesController {
  constructor(private svc: SalesService) {}
  @Get() list(@Query() query: QueryActivitiesDto, @CurrentUser() user: AuthUser) { return this.svc.listActivities(user, query); }
  @Post() create(@Body() dto: CreateActivityDto, @CurrentUser() user: AuthUser) { return this.svc.createActivity(dto, user); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateActivityDto, @CurrentUser() user: AuthUser) { return this.svc.updateActivity(id, dto, user); }
  @Post(":id/check-in") checkIn(@Param("id") id: string, @Body() dto: CheckInDto, @CurrentUser() user: AuthUser) { return this.svc.checkIn(id, dto, user); }
  @Post(":id/check-out") checkOut(@Param("id") id: string, @Body() dto: CheckOutDto, @CurrentUser() user: AuthUser) { return this.svc.checkOut(id, dto, user); }
}

@ApiTags("sales-leads") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/leads")
export class SalesLeadsController {
  constructor(private svc: SalesService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Query("assignedToId") assignedToId?: string) { return this.svc.listLeads(user, assignedToId); }
  @Get(":id") detail(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.leadDetail(id, user); }
  @Post() create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthUser) { return this.svc.createLead(dto, user); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateLeadDto, @CurrentUser() user: AuthUser) { return this.svc.updateLead(id, dto, user); }
  @Post(":id/convert") convert(@Param("id") id: string, @Body() dto: ConvertLeadDto, @CurrentUser() user: AuthUser) { return this.svc.convertLead(id, dto, user); }
}

@ApiTags("sales-follow-ups") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/follow-ups")
export class SalesFollowUpsController {
  constructor(private svc: SalesService) {}
  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query("bucket") bucket?: "today" | "upcoming" | "overdue" | "completed",
    @Query("userId") userId?: string,
  ) { return this.svc.listFollowUps(user, bucket, userId); }
  @Post() create(@Body() dto: CreateFollowUpDto, @CurrentUser() user: AuthUser) { return this.svc.createFollowUp(dto, user); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFollowUpDto, @CurrentUser() user: AuthUser) { return this.svc.updateFollowUp(id, dto, user); }
  @Post(":id/complete") complete(@Param("id") id: string, @Body() dto: CompleteFollowUpDto, @CurrentUser() user: AuthUser) { return this.svc.completeFollowUp(id, dto, user); }
}

@ApiTags("sales-opportunities") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/opportunities")
export class SalesOpportunitiesController {
  constructor(private svc: SalesService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Query("assignedToId") assignedToId?: string, @Query("stage") stage?: string) {
    return this.svc.listOpportunities(user, assignedToId, stage);
  }
  @Get(":id") detail(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.opportunityDetail(id, user); }
  @Post() create(@Body() dto: CreateOpportunityDto, @CurrentUser() user: AuthUser) { return this.svc.createOpportunity(dto, user); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateOpportunityDto, @CurrentUser() user: AuthUser) { return this.svc.updateOpportunity(id, dto, user); }
}

@ApiTags("sales-daily-reports") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/daily-reports")
export class SalesDailyReportsController {
  constructor(private svc: SalesService) {}
  @Get("today") today(@CurrentUser() user: AuthUser) { return this.svc.todayReport(user); }
  @Post("today") upsert(@Body() dto: UpsertDailyReportDto, @CurrentUser() user: AuthUser) { return this.svc.upsertDailyReport(dto, user); }
  @Post(":id/submit") submit(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.submitDailyReport(id, user); }
  @Patch(":id/review") @Roles(...MANAGE) review(@Param("id") id: string, @Body() dto: ReviewDailyReportDto, @CurrentUser() user: AuthUser) {
    return this.svc.reviewDailyReport(id, dto, user);
  }
  @Get() list(@Query() query: QueryDateRangeDto, @CurrentUser() user: AuthUser) { return this.svc.listDailyReports(user, query); }
}

@ApiTags("sales-targets") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/targets")
export class SalesTargetsController {
  constructor(private svc: SalesService) {}
  @Get() list(@CurrentUser() user: AuthUser) { return this.svc.listTargets(user); }
  @Post() @Roles(...MANAGE) create(@Body() dto: CreateTargetDto, @CurrentUser() user: AuthUser) { return this.svc.createTarget(dto, user); }
  @Get("achievement/:userId") achievement(
    @Param("userId") userId: string, @CurrentUser() user: AuthUser,
    @Query("periodStart") periodStart: string, @Query("periodEnd") periodEnd: string,
  ) { return this.svc.achievement(user, userId, periodStart, periodEnd); }
}

@ApiTags("sales-dashboard") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("sales/dashboard")
export class SalesDashboardController {
  constructor(private svc: SalesService) {}
  @Get() dashboard(@CurrentUser() user: AuthUser) { return this.svc.dashboard(user); }
  @Get("team-performance") teamPerformance(
    @CurrentUser() user: AuthUser, @Query("dateFrom") dateFrom?: string, @Query("dateTo") dateTo?: string,
  ) { return this.svc.teamPerformance(user, dateFrom, dateTo); }
  @Get("salesperson/:userId") salespersonDetail(@Param("userId") userId: string, @CurrentUser() user: AuthUser) {
    return this.svc.salespersonDetail(userId, user);
  }
}

@ApiTags("sales-schools") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...SALES)
@Controller("sales/schools")
export class SalesSchoolsController {
  constructor(private svc: SalesService) {}
  @Get(":schoolId/history") history(@Param("schoolId") schoolId: string, @CurrentUser() user: AuthUser) {
    return this.svc.schoolActivityHistory(schoolId, user);
  }
}

@Module({
  imports: [TasksModule],
  controllers: [
    SalesMyDayController, SalesActivitiesController, SalesLeadsController, SalesFollowUpsController,
    SalesOpportunitiesController, SalesDailyReportsController, SalesTargetsController, SalesDashboardController,
    SalesSchoolsController,
  ],
  providers: [SalesService],
})
export class SalesModule {}
