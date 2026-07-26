import { IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";
import { QuestionType } from "@educore/database";

export class CreateQuizDto {
  @IsString() courseId: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateQuizDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateQuestionDto {
  @IsString() questionText: string;
  @IsOptional() @IsEnum(QuestionType) type?: QuestionType;
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsString() correctAnswer?: string;
  @IsOptional() @IsInt() @Min(1) marks?: number;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

export class UpdateQuestionDto {
  @IsOptional() @IsString() questionText?: string;
  @IsOptional() @IsEnum(QuestionType) type?: QuestionType;
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsString() correctAnswer?: string;
  @IsOptional() @IsInt() @Min(1) marks?: number;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

export class SubmitAttemptDto {
  @IsObject() answers: Record<string, string>;
}
