import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength, ArrayMinSize, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class StudentLinkDto {
  @IsString() studentId: string;
  @IsOptional() @IsString() relation?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateParentDto {
  @IsString() fullName: string;
  @IsEmail() email: string;
  @IsString() phone: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StudentLinkDto)
  students: StudentLinkDto[];
  /** Optional — if omitted, a temporary password is generated and returned once. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class UpdateParentDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryParentsDto {
  @IsOptional() @IsString() q?: string;
}
