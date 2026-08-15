import { IsEnum, IsOptional, IsString } from "class-validator";
import { CircuitSimulator } from "@educore/database";

export class CreateCircuitProjectDto {
  @IsString() title: string;
  @IsEnum(CircuitSimulator) simulator: CircuitSimulator;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() projectUrl?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCircuitProjectDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() projectUrl?: string;
  @IsOptional() @IsString() notes?: string;
}

export class QueryCircuitProjectsDto {
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() studentId?: string;
}

export class ReviewCircuitProjectDto {
  @IsOptional() @IsString() feedback?: string;
}
