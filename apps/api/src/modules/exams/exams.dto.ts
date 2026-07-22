import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class ExamSubjectInputDto {
  @IsString() subjectId: string;
  @IsOptional() @IsInt() @Min(1) maxMarks?: number;
}

export class CreateExamDto {
  @IsString() schoolId: string;
  @IsString() name: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ExamSubjectInputDto)
  subjects: ExamSubjectInputDto[];
}

export class ResultEntryDto {
  @IsString() studentId: string;
  @IsNumber() marks: number;
  @IsOptional() @IsString() remark?: string;
}

export class RecordResultsDto {
  @IsString() examSubjectId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ResultEntryDto)
  entries: ResultEntryDto[];
}
