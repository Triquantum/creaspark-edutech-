import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { EmploymentType, Role, SalaryPaidBy } from "@educore/database";

/** One (school, role) grant -- see UserAccess in schema.prisma. `id` present
 * means "update this existing grant"; omitted means "create a new one". */
export class GrantDto {
  @IsOptional() @IsString() id?: string;
  @IsString() schoolId: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateEmployeeDto {
  @IsString() schoolId: string;
  @IsString() fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsEnum(Role) role: Role;
  @IsString() employeeNo: string;
  @IsString() designation: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(SalaryPaidBy) salaryPaidBy?: SalaryPaidBy;
  @IsOptional() @IsNumber() @Min(0) salary?: number;
  /** Omitted -> StaffProfile.joinDate defaults to now(), same as before this field existed. */
  @IsOptional() @IsDateString() joinDate?: string;
  /** Optional — if omitted, a temporary password is generated and returned once. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
  /** Additional (school, role) grants beyond the primary one above -- the
   * primary always comes from the top-level fields, since that's what the
   * Supabase Auth account itself gets created with. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GrantDto) grants?: GrantDto[];
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
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(SalaryPaidBy) salaryPaidBy?: SalaryPaidBy;
  @IsOptional() @IsNumber() @Min(0) salary?: number;
  @IsOptional() @IsDateString() joinDate?: string;
  /** Set when isActive is turning false; sent as null to clear it when
   * isActive turns back to true. */
  @IsOptional() @IsDateString() lastWorkingDate?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** When present, replaces this employee's entire grant list (must include
   * exactly one isPrimary: true); when absent, the top-level fields above
   * edit the primary grant only -- today's exact single-grant behavior. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GrantDto) grants?: GrantDto[];
}

export class SalaryCertificateDto {
  @IsOptional() @IsString() refNo?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsString() signatoryName: string;
  @IsString() signatoryDesignation: string;
}

/** Basic Salary is deliberately not a field here -- it always comes from
 * the employee's own StaffProfile.salary, never a caller-supplied figure
 * (see salarySlipPdf()). These four are additive line items on top of it. */
export class SalarySlipDto {
  @IsString() period: string;
  @IsIn(["BANK_TRANSFER", "CASH"]) paymentMode: "BANK_TRANSFER" | "CASH";
  @IsOptional() @IsNumber() @Min(0) pettyCash?: number;
  @IsOptional() @IsNumber() @Min(0) overtime?: number;
  @IsOptional() @IsNumber() @Min(0) deduction?: number;
  @IsOptional() @IsNumber() @Min(0) pendingAmount?: number;
}
