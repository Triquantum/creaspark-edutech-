import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateLeaveTypeDto {
  @IsString() name: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) daysPerYear?: number;
}

export class UpdateLeaveTypeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) daysPerYear?: number;
}

export class AssignLeaveBalanceDto {
  @IsString() userId: string;
  @IsString() leaveTypeId: string;
  @IsInt() @Min(2000) @Max(2100) year: number;
  @IsInt() @Min(0) @Max(365) allotted: number;
}

export class CreateLeaveApplicationDto {
  @IsString() leaveTypeId: string;
  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;
  @IsString() reason: string;
}

export class ReviewLeaveApplicationDto {
  @IsIn(["APPROVED", "REJECTED"]) status: "APPROVED" | "REJECTED";
  @IsOptional() @IsString() reviewRemarks?: string;
}
