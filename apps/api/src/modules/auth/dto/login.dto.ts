import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterSchoolDto {
  @IsString() schoolName: string;
  @IsString() schoolCode: string;
  @IsString() adminFullName: string;
  @IsEmail() adminEmail: string;
  @IsString() @MinLength(8) adminPassword: string;
}

export class LoginWithTokenDto {
  @IsString() token: string;
  @IsString() password: string;
}
