import { IsArray, IsDateString, IsOptional, IsString } from "class-validator";

export class CreateHolidayDto {
  @IsString() subject: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  /** Supabase Storage public URLs -- the browser uploads directly to the
   * "holiday-images" bucket (same convention as School.logoUrl) and sends
   * back the resulting URLs, so the API never touches file bytes. */
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
}

export class UpdateHolidayDto {
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
}
