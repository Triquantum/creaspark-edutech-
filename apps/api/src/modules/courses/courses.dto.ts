import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { CourseStatus } from "@educore/database";

export class CreateCourseDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() classId?: string;
}

export class UpdateCourseDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsEnum(CourseStatus) status?: CourseStatus;
}

export class QueryCoursesDto {
  @IsOptional() @IsString() studentId?: string;
}

export class CreateLessonDto {
  @IsString() title: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

export class UpdateLessonDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
}
