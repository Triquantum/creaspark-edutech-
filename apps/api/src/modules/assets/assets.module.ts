import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { Role } from "@educore/database";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { AssetsService } from "./assets.service";
import {
  AdjustStockDto, CreateAllocationDto, CreateAssetCategoryDto, CreateAssetItemDto, CreateLocationDto,
  CreateVendorDto, DeliverAllocationDto, DistributionPlanConfirmDto, DistributionPlanPreviewDto,
  QueryAssetItemsDto, RecordMovementDto, UpdateAssetCategoryDto, UpdateAssetItemDto, UpdateLocationDto,
  UpdateVendorDto,
} from "./assets.dto";

// Same manage-role set as the pre-existing InventoryItemModule (Inventory >
// Product): platform/org/school admins plus the dedicated inventory role.
const MANAGE = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.INVENTORY_MANAGER] as const;

@ApiTags("asset-categories") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/categories")
export class AssetCategoriesController {
  constructor(private svc: AssetsService) {}
  @Get() list() { return this.svc.categories(); }
  @Get(":id") detail(@Param("id") id: string) { return this.svc.categoryDetail(id); }
  @Post() create(@Body() dto: CreateAssetCategoryDto) { return this.svc.createCategory(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateAssetCategoryDto) { return this.svc.updateCategory(id, dto); }
}

@ApiTags("asset-vendors") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/vendors")
export class VendorsController {
  constructor(private svc: AssetsService) {}
  @Get() list() { return this.svc.vendors(); }
  @Post() create(@Body() dto: CreateVendorDto) { return this.svc.createVendor(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateVendorDto) { return this.svc.updateVendor(id, dto); }
}

@ApiTags("asset-locations") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/locations")
export class LocationsController {
  constructor(private svc: AssetsService) {}
  @Get() list() { return this.svc.locations(); }
  @Post() create(@Body() dto: CreateLocationDto) { return this.svc.createLocation(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateLocationDto) { return this.svc.updateLocation(id, dto); }
}

@ApiTags("asset-items") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/items")
export class AssetItemsController {
  constructor(private svc: AssetsService) {}

  @Get() list(@Query() query: QueryAssetItemsDto, @CurrentUser() user: AuthUser) { return this.svc.listItems(user, query); }
  @Get(":id") detail(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.itemDetail(id, user); }
  @Post() create(@Body() dto: CreateAssetItemDto, @CurrentUser() user: AuthUser) { return this.svc.createItem(dto, user); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateAssetItemDto, @CurrentUser() user: AuthUser) { return this.svc.updateItem(id, dto, user); }
  @Delete(":id") remove(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.removeItem(id, user); }

  @Post(":id/adjust-stock")
  adjustStock(@Param("id") id: string, @Body() dto: AdjustStockDto, @CurrentUser() user: AuthUser) {
    return this.svc.adjustStock(id, dto, user);
  }

  @Post(":id/movement")
  recordMovement(@Param("id") id: string, @Body() dto: RecordMovementDto, @CurrentUser() user: AuthUser) {
    return this.svc.recordMovement(id, dto, user);
  }
}

@ApiTags("asset-allocations") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/allocations")
export class AssetAllocationsController {
  constructor(private svc: AssetsService) {}
  @Post() allocate(@Body() dto: CreateAllocationDto, @CurrentUser() user: AuthUser) { return this.svc.allocate(dto, user); }
  @Delete(":id") cancel(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.cancelAllocation(id, user); }
  @Post(":id/deliver") deliver(@Param("id") id: string, @Body() dto: DeliverAllocationDto, @CurrentUser() user: AuthUser) {
    return this.svc.deliver(id, dto, user);
  }
}

@ApiTags("asset-distribution-plan") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/distribution-plan")
export class DistributionPlanController {
  constructor(private svc: AssetsService) {}
  @Post("preview") preview(@Body() dto: DistributionPlanPreviewDto, @CurrentUser() user: AuthUser) {
    return this.svc.previewDistributionPlan(dto, user);
  }
  @Post("confirm") confirm(@Body() dto: DistributionPlanConfirmDto, @CurrentUser() user: AuthUser) {
    return this.svc.confirmDistributionPlan(dto, user);
  }
}

@ApiTags("asset-schools") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/schools")
export class AssetSchoolsController {
  constructor(private svc: AssetsService) {}
  @Get() list(@CurrentUser() user: AuthUser) { return this.svc.schoolsRollup(user); }
  @Get(":id") detail(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.svc.schoolDetail(id, user); }
}

@ApiTags("asset-dashboard") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/dashboard")
export class AssetDashboardController {
  constructor(private svc: AssetsService) {}
  @Get() dashboard(@CurrentUser() user: AuthUser) { return this.svc.dashboard(user); }
}

@ApiTags("asset-reports") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...MANAGE)
@Controller("assets/reports")
export class AssetReportsController {
  constructor(private svc: AssetsService) {}

  @Get("distribution-matrix")
  distributionMatrix(@CurrentUser() user: AuthUser) { return this.svc.distributionMatrix(user); }

  @Get("inventory.csv")
  async inventoryCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.svc.inventoryCsv(user);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="inventory-report.csv"');
    res.send(csv);
  }

  @Get("distribution-matrix.csv")
  async distributionMatrixCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.svc.distributionMatrixCsv(user);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="distribution-matrix.csv"');
    res.send(csv);
  }
}

@Module({
  controllers: [
    AssetCategoriesController, VendorsController, LocationsController, AssetItemsController,
    AssetAllocationsController, DistributionPlanController, AssetSchoolsController,
    AssetDashboardController, AssetReportsController,
  ],
  providers: [AssetsService],
})
export class AssetsModule {}
