import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "@educore/database";

export class CreateEmployeeDto {
  @IsString() schoolId: string;
  @IsString() fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsEnum(Role) role: Role;
  @IsString() employeeNo: string;
  @IsString() designation: string;
  @IsOptional() @IsString() department?: string;
  /** Optional — if omitted, a temporary password is generated and returned once. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
