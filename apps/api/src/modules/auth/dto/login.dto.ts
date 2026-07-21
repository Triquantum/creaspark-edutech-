import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

export class RefreshDto {
  @IsString() refreshToken: string;
}

export class RequestResetDto {
  @IsEmail() email: string;
}

export class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(8) newPassword: string;
}

export class RegisterSchoolDto {
  @IsString() schoolName: string;
  @IsString() schoolCode: string;
  @IsString() adminFullName: string;
  @IsEmail() adminEmail: string;
  @IsString() @MinLength(8) adminPassword: string;
}
