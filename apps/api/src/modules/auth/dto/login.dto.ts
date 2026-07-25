import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { InstitutionType } from "@educore/database";

export class RegisterSchoolDto {
  @IsString() schoolName: string;
  @IsString() schoolCode: string;
  @IsString() adminFullName: string;
  @IsEmail() adminEmail: string;
  @IsString() @MinLength(8) adminPassword: string;
  @IsOptional() @IsEnum(InstitutionType) institutionType?: InstitutionType;
}

export class LoginWithTokenDto {
  @IsString() token: string;
  @IsString() password: string;
}
