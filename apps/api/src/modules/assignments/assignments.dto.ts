import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { ContentStatus } from "@educore/database";

export class CreateAssignmentDto {
  @IsString() subjectId: string;
  @IsString() schoolId: string;
  @IsOptional() @IsString() classId?: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsInt() @Min(1) maxMarks?: number;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class UpdateAssignmentDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsInt() @Min(1) maxMarks?: number;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class QueryAssignmentsDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
}

export class SubmitAssignmentDto {
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
}

export class GradeSubmissionDto {
  @IsInt() @Min(0) marksAwarded: number;
  @IsOptional() @IsString() feedback?: string;
}
