import { IsObject, IsOptional, IsString } from "class-validator";

/** Generic shape used by every catch-all module page until it gets a real schema. */
export class RecordDataDto {
  @IsString() name: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsObject() fields?: Record<string, string>;
}

export class QueryRecordsDto {
  @IsOptional() @IsString() q?: string;
}
