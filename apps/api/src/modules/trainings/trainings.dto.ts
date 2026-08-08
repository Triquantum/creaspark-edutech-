import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Role } from "@educore/database";

export class CreateTrainingDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() conductedAt: string;
  /** Empty/omitted = every role. */
  @IsOptional() @IsArray() @IsEnum(Role, { each: true }) targetRoles?: Role[];
  /** Omitted = every school, platform-wide. */
  @IsOptional() @IsString() targetSchoolId?: string;
}

export class SubmitFeedbackDto {
  @IsInt() @Min(1) @Max(5) contentRating: number;
  @IsInt() @Min(1) @Max(5) trainerRating: number;
  @IsInt() @Min(1) @Max(5) usefulnessRating: number;
  @IsInt() @Min(1) @Max(5) overallRating: number;
  @IsOptional() @IsString() comments?: string;
}
