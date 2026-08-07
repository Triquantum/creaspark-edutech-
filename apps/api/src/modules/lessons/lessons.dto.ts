import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { ContentStatus } from "@educore/database";

export class CreateLessonDto {
  @IsString() subjectId: string;
  @IsString() schoolId: string;
  @IsOptional() @IsString() classId?: string;
  @IsString() title: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class UpdateLessonDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class QueryLessonsDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() studentId?: string;
}

export class QueryProgressDto {
  @IsString() subjectId: string;
  // Required for teacher/admin callers (which school+class to roster);
  // STUDENT/PARENT derive their own school+class server-side instead, since
  // the frontend has no easy way to know that ahead of time for them.
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() studentId?: string;
}

export class RecordViewDto {
  @IsOptional() @IsString() subjectId?: string;
}
