import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
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
  @IsOptional() @IsString() schoolId?: string;
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

/** One row from an uploaded spreadsheet. className/sectionName are resolved
 * to a sectionId server-side (case-insensitive name match within the target
 * school) rather than asking the sheet to contain internal IDs. */
export class BulkStudentRowDto {
  @IsString() admissionNo: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @IsString() className?: string;
  @IsOptional() @IsString() sectionName?: string;
}

export class BulkUpsertStudentsDto {
  @IsString() schoolId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BulkStudentRowDto)
  rows: BulkStudentRowDto[];
}
