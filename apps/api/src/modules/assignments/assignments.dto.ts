import { IsDateString, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateAssignmentDto {
  @IsString() courseId: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsInt() @Min(1) maxMarks?: number;
}

export class UpdateAssignmentDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsInt() @Min(1) maxMarks?: number;
}

export class SubmitAssignmentDto {
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
}

export class GradeSubmissionDto {
  @IsInt() @Min(0) marksAwarded: number;
  @IsOptional() @IsString() feedback?: string;
}
