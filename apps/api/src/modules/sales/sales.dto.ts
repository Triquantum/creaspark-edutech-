import {
  IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min,
} from "class-validator";
import {
  SalesActivityType, SalesFollowUpStatus, SalesLeadSource, SalesLeadStatus,
  SalesOpportunityStage, SalesPriority, SalesTargetMetric, SalesTargetPeriod, TaskStatus,
} from "@educore/database";

export class CreateActivityDto {
  @IsEnum(SalesActivityType) type: SalesActivityType;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() opportunityId?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() outcome?: string;
  @IsOptional() @IsDateString() activityDate?: string;
  @IsOptional() @IsDateString() startTime?: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() nextFollowUpDate?: string;
  @IsOptional() @IsEnum(SalesPriority) priority?: SalesPriority;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  /** When true and nextAction is set, also creates a TaskItem assigned to
   * the caller in the existing Task Manager (Section 29 integration). */
  @IsOptional() @IsBoolean() createTask?: boolean;
}

export class UpdateActivityDto {
  @IsOptional() @IsString() outcome?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() activityDate?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() nextFollowUpDate?: string;
  @IsOptional() @IsEnum(SalesPriority) priority?: SalesPriority;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

export class CheckInDto {
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}
export class CheckOutDto {
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() outcome?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() nextFollowUpDate?: string;
}

export class QueryActivitiesDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() opportunityId?: string;
  @IsOptional() @IsEnum(SalesActivityType) type?: SalesActivityType;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

export class CreateLeadDto {
  @IsString() schoolName: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEnum(SalesLeadSource) source?: SalesLeadSource;
  @IsOptional() @IsEnum(SalesPriority) priority?: SalesPriority;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() assignedToId?: string;
}
export class UpdateLeadDto {
  @IsOptional() @IsString() schoolName?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEnum(SalesLeadSource) source?: SalesLeadSource;
  @IsOptional() @IsEnum(SalesLeadStatus) status?: SalesLeadStatus;
  @IsOptional() @IsEnum(SalesPriority) priority?: SalesPriority;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() assignedToId?: string;
}
export class ConvertLeadDto {
  @IsString() schoolId: string;
}

export class CreateFollowUpDto {
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() opportunityId?: string;
  @IsString() nextAction: string;
  @IsDateString() dueDate: string;
  @IsOptional() @IsEnum(SalesPriority) priority?: SalesPriority;
  @IsOptional() @IsString() assignedToId?: string;
}
export class UpdateFollowUpDto {
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsEnum(SalesPriority) priority?: SalesPriority;
  @IsOptional() @IsEnum(SalesFollowUpStatus) status?: SalesFollowUpStatus;
}
export class CompleteFollowUpDto {
  @IsOptional() @IsEnum(SalesActivityType) resultActivityType?: SalesActivityType;
  @IsOptional() @IsString() outcome?: string;
}

export class CreateOpportunityDto {
  @IsString() title: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsDateString() expectedClosingDate?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() nextFollowUpDate?: string;
  @IsOptional() @IsString() assignedToId?: string;
}
export class UpdateOpportunityDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsEnum(SalesOpportunityStage) stage?: SalesOpportunityStage;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsDateString() expectedClosingDate?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() nextFollowUpDate?: string;
  @IsOptional() @IsString() lostReason?: string;
}

export class UpsertDailyReportDto {
  @IsOptional() @IsString() achievements?: string;
  @IsOptional() @IsString() majorOpportunities?: string;
  @IsOptional() @IsString() challenges?: string;
  @IsOptional() @IsString() supportRequired?: string;
  @IsOptional() @IsString() tomorrowPriorities?: string;
  @IsOptional() @IsString() tomorrowPlan?: string;
}
export class ReviewDailyReportDto {
  @IsString() managerComments: string;
}

export class CreateTargetDto {
  @IsOptional() @IsString() userId?: string;
  @IsEnum(SalesTargetPeriod) period: SalesTargetPeriod;
  @IsDateString() periodStart: string;
  @IsDateString() periodEnd: string;
  @IsEnum(SalesTargetMetric) metric: SalesTargetMetric;
  @IsNumber() @Min(0) targetValue: number;
}

export class QueryDateRangeDto {
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsString() userId?: string;
}
