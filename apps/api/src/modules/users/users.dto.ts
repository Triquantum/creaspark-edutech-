import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Gender, Role } from "@educore/database";

export class CreateUserDto {
  @IsString() fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsEnum(Role) role: Role;
  /** Optional — if omitted, a temporary password is generated and returned once. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
  /** Which school's tenant this login belongs to — required for SUPER_ADMIN. */
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() department?: string;
  /** Extra schools this login is also associated with (as UserAccess rows,
   * not a StaffProfile move) — Super Admin/Org Admin only. The literal
   * "ALL" expands to every school in the same organization as `schoolId`. */
  @IsOptional() @IsArray() @IsString({ each: true }) schoolIds?: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Moves the user to a different school (and its tenant) — only
   * SUPER_ADMIN/ORG_ADMIN may set this. */
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() department?: string;
  /** When present, replaces this user's entire school-association list. */
  @IsOptional() @IsArray() @IsString({ each: true }) schoolIds?: string[];
}

export class QueryUsersDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() schoolId?: string;
}
