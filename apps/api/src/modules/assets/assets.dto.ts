import {
  ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber,
  IsObject, IsOptional, IsString, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateAssetCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}
export class UpdateAssetCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class CreateVendorDto {
  @IsString() name: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateVendorDto extends CreateVendorDto {
  @IsOptional() @IsString() declare name: string;
  @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class CreateLocationDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}
export class UpdateLocationDto extends CreateLocationDto {
  @IsOptional() @IsString() declare name: string;
  @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class CreateAssetItemDto {
  @IsOptional() @IsString() itemCode?: string;
  @IsString() itemName: string;
  @IsString() assetCategoryId: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsInt() @Min(0) totalQuantity?: number;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAssetItemDto {
  @IsOptional() @IsString() itemName?: string;
  @IsOptional() @IsString() assetCategoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsIn(["ACTIVE", "DISCONTINUED"]) status?: string;
}

export class QueryAssetItemsDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() assetCategoryId?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsIn(["LOW", "OUT", "IN_STOCK"]) stockStatus?: "LOW" | "OUT" | "IN_STOCK";
}

export class AdjustStockDto {
  @IsInt() @Min(0) newTotalQuantity: number;
  @IsString() reason: string;
}

export class RecordMovementDto {
  @IsIn(["RETURN", "DAMAGE", "LOST"]) type: "RETURN" | "DAMAGE" | "LOST";
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() remarks?: string;
}

export class CreateAllocationDto {
  @IsString() assetItemId: string;
  @IsString() schoolId: string;
  @IsInt() @Min(1) quantity: number;
}

export class DeliverAllocationDto {
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsBoolean() full?: boolean;
}

export class DistributionPlanPreviewDto {
  @IsString() assetItemId: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) schoolIds: string[];
  @IsIn(["EQUAL", "MANUAL"]) mode: "EQUAL" | "MANUAL";
  @IsOptional() @IsObject() manualQuantities?: Record<string, number>;
}

class ConfirmAllocationRow {
  @IsString() schoolId: string;
  @IsInt() @Min(0) quantity: number;
}

export class DistributionPlanConfirmDto {
  @IsString() assetItemId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ConfirmAllocationRow)
  allocations: ConfirmAllocationRow[];
}
