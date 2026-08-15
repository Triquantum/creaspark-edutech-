import {
  ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt,
  IsOptional, IsString, Max, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Role, TrainingStatus } from "@educore/database";

export class CreateTrainingDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() venue?: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() resourcePerson?: string;
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsEnum(TrainingStatus) status?: TrainingStatus;
  @IsDateString() conductedAt: string;
  /** Empty/omitted = every role. */
  @IsOptional() @IsArray() @IsEnum(Role, { each: true }) targetRoles?: Role[];
  /** Omitted = every school, platform-wide. */
  @IsOptional() @IsString() targetSchoolId?: string;
}

export class UpdateTrainingStatusDto {
  @IsEnum(TrainingStatus) status: TrainingStatus;
}

class AttendanceRecordDto {
  @IsString() userId: string;
  @IsBoolean() present: boolean;
}

export class MarkAttendanceDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AttendanceRecordDto)
  records: AttendanceRecordDto[];
}

export class SubmitFeedbackDto {
  @IsInt() @Min(1) @Max(5) contentRating: number;
  @IsInt() @Min(1) @Max(5) trainerRating: number;
  @IsInt() @Min(1) @Max(5) usefulnessRating: number;
  @IsInt() @Min(1) @Max(5) overallRating: number;
  @IsOptional() @IsString() comments?: string;
}
