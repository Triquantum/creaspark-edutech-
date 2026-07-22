import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "@educore/database";

export class CreateUserDto {
  @IsString() fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsEnum(Role) role: Role;
  /** Optional — if omitted, a temporary password is generated and returned once. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
  /** Which school's tenant this login belongs to — required for SUPER_ADMIN. */
  @IsOptional() @IsString() schoolId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryUsersDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() schoolId?: string;
}
