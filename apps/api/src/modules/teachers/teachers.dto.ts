import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateTeacherDto {
  @IsString() schoolId: string;
  @IsString() fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() employeeNo: string;
  @IsString() designation: string;
  @IsOptional() @IsString() department?: string;
  /** Optional — if omitted, a temporary password is generated and returned once. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class UpdateTeacherDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
