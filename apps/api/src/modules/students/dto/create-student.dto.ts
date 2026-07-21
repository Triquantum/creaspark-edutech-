import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { Gender } from "@educore/database";

export class CreateStudentDto {
  @IsString() schoolId: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsString() admissionNo: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsDateString() dob?: string;
}

export class QueryStudentsDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsOptional() @IsString() cursor?: string;
}

export class UpdateStudentDto {
  @IsOptional() @IsString() sectionId?: string;
  @IsOptional() @IsString() admissionNo?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @IsString() rollNo?: string;
  @IsOptional() @IsString() house?: string;
}
