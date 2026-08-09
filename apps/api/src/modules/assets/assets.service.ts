import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetTransactionType, Prisma, Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import {
  AdjustStockDto, CreateAllocationDto, CreateAssetCategoryDto, CreateAssetItemDto, CreateLocationDto,
  CreateVendorDto, DeliverAllocationDto, DistributionPlanConfirmDto, DistributionPlanPreviewDto,
  QueryAssetItemsDto, RecordMovementDto, UpdateAssetCategoryDto, UpdateAssetItemDto, UpdateLocationDto,
  UpdateVendorDto,
} from "./assets.dto";

const CROSS_TENANT_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ORG_ADMIN];

function isCrossTenant(user: AuthUser): boolean {
  return CROSS_TENANT_ROLES.includes(user.role as Role);
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type ItemWithAllocations = Prisma.AssetItemGetPayload<{ include: { allocations: true } }>;

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  private async audit(user: AuthUser, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { tenantId: currentTenant().tenantId, userId: user.id, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  private conflictOrThrow(e: unknown, message: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new BadRequestException(message);
    throw e;
  }

  /** Derives allocated/delivered/available/pending from the AssetAllocation
   * rows rather than storing them on AssetItem, so they can never drift out
   * of sync with the underlying allocation ledger. Generic over the exact
   * include shape so both the plain itemWithAllocations() payload and
   * itemDetail()'s richer include (nested school/allocatedBy) both work. */
  private computeStock<
    T extends {
      totalQuantity: number; damagedQuantity: number; lostQuantity: number; returnedQuantity: number;
      allocations: { allocatedQuantity: number; deliveredQuantity: number }[];
    },
  >(item: T) {
    const allocatedQuantity = item.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
    const deliveredQuantity = item.allocations.reduce((s, a) => s + a.deliveredQuantity, 0);
    const availableQuantity = item.totalQuantity - allocatedQuantity - item.damagedQuantity - item.lostQuantity + item.returnedQuantity;
    const pendingQuantity = allocatedQuantity - deliveredQuantity;
    const { allocations, ...rest } = item;
    return { ...rest, allocatedQuantity, deliveredQuantity, availableQuantity, pendingQuantity };
  }

  private async itemWithAllocations(id: string): Promise<ItemWithAllocations> {
    const item = await this.prisma.assetItem.findUnique({ where: { id }, include: { allocations: true } });
    if (!item) throw new NotFoundException("Inventory item not found");
    return item;
  }

  private assertCanActItem(user: AuthUser, item: { tenantId: string }) {
    if (!isCrossTenant(user) && item.tenantId !== currentTenant().tenantId) throw new NotFoundException("Inventory item not found");
  }

  /** SUPER_ADMIN/ORG_ADMIN may target any registered, non-suspended school;
   * everyone else is confined to their own tenant -- same crossTenant gate
   * used throughout this app (Tasks, Employees, Training). */
  private async resolveSchool(user: AuthUser, schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("School not found");
    if (!isCrossTenant(user) && school.tenantId !== currentTenant().tenantId) {
      throw new NotFoundException("School not found in your organization");
    }
    return school;
  }

  // ────────────────────────── Categories ──────────────────────────

  categories() {
    return this.prisma.assetCategory.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } });
  }

  async createCategory(dto: CreateAssetCategoryDto) {
    try {
      return await this.prisma.assetCategory.create({ data: dto });
    } catch (e) {
      return this.conflictOrThrow(e, "A category with this name already exists");
    }
  }

  async updateCategory(id: string, dto: UpdateAssetCategoryDto) {
    const existing = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");
    try {
      return await this.prisma.assetCategory.update({ where: { id }, data: dto });
    } catch (e) {
      return this.conflictOrThrow(e, "A category with this name already exists");
    }
  }

  async categoryDetail(id: string) {
    const category = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Category not found");
    const items = await this.prisma.assetItem.findMany({ where: { assetCategoryId: id }, include: { allocations: true } });
    const withStock = items.map((i) => this.computeStock(i));
    const schoolIds = new Set(items.flatMap((i) => i.allocations.map((a) => a.schoolId)));
    return {
      category,
      itemCount: items.length,
      totalStock: items.reduce((s, i) => s + i.totalQuantity, 0),
      allocatedStock: withStock.reduce((s, i) => s + i.allocatedQuantity, 0),
      availableStock: withStock.reduce((s, i) => s + i.availableQuantity, 0),
      schoolCount: schoolIds.size,
      items: withStock,
    };
  }

  // ────────────────────────── Vendors ──────────────────────────

  vendors() {
    return this.prisma.vendor.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } });
  }

  async createVendor(dto: CreateVendorDto) {
    try {
      return await this.prisma.vendor.create({ data: dto });
    } catch (e) {
      return this.conflictOrThrow(e, "A vendor with this name already exists");
    }
  }

  async updateVendor(id: string, dto: UpdateVendorDto) {
    const existing = await this.prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Vendor not found");
    try {
      return await this.prisma.vendor.update({ where: { id }, data: dto });
    } catch (e) {
      return this.conflictOrThrow(e, "A vendor with this name already exists");
    }
  }

  // ────────────────────────── Locations ──────────────────────────

  locations() {
    return this.prisma.location.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } });
  }

  async createLocation(dto: CreateLocationDto) {
    try {
      return await this.prisma.location.create({ data: dto });
    } catch (e) {
      return this.conflictOrThrow(e, "A location with this name already exists");
    }
  }

  async updateLocation(id: string, dto: UpdateLocationDto) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Location not found");
    try {
      return await this.prisma.location.update({ where: { id }, data: dto });
    } catch (e) {
      return this.conflictOrThrow(e, "A location with this name already exists");
    }
  }

  // ────────────────────────── Inventory items ──────────────────────────

  async listItems(user: AuthUser, query: QueryAssetItemsDto) {
    const crossTenant = isCrossTenant(user);
    const and: Prisma.AssetItemWhereInput[] = [];
    if (!crossTenant) and.push({ tenantId: currentTenant().tenantId });
    if (query.assetCategoryId) and.push({ assetCategoryId: query.assetCategoryId });
    if (query.locationId) and.push({ locationId: query.locationId });
    if (query.vendorId) and.push({ vendorId: query.vendorId });
    if (query.q) {
      and.push({
        OR: [
          { itemName: { contains: query.q, mode: "insensitive" as const } },
          { itemCode: { contains: query.q, mode: "insensitive" as const } },
        ],
      });
    }
    const items = await this.prisma.assetItem.findMany({
      where: { AND: and },
      include: {
        assetCategory: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        allocations: { select: { allocatedQuantity: true, deliveredQuantity: true } },
      },
      orderBy: { itemName: "asc" },
      take: 300,
    });
    const withStock = items.map((i) => this.computeStock(i));
    if (!query.stockStatus) return withStock;
    return withStock.filter((i) => {
      if (query.stockStatus === "OUT") return i.availableQuantity <= 0;
      if (query.stockStatus === "LOW") return i.reorderLevel != null && i.availableQuantity <= i.reorderLevel && i.availableQuantity > 0;
      return i.availableQuantity > 0;
    });
  }

  async itemDetail(id: string, user: AuthUser) {
    const item = await this.prisma.assetItem.findUnique({
      where: { id },
      include: {
        assetCategory: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        createdBy: { select: { fullName: true } },
        updatedBy: { select: { fullName: true } },
        allocations: { include: { school: { select: { id: true, name: true, code: true } }, allocatedBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
        transactions: { include: { user: { select: { fullName: true } }, school: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    this.assertCanActItem(user, item);
    return { ...this.computeStock(item), allocations: item.allocations, transactions: item.transactions };
  }

  private async generateItemCode(categoryName: string): Promise<string> {
    const prefix = (categoryName.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "AST").toUpperCase();
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
      const code = `${prefix}-${suffix}`;
      const clash = await this.prisma.assetItem.findUnique({ where: { itemCode: code } });
      if (!clash) return code;
    }
    throw new BadRequestException("Could not generate a unique item code, please provide one manually");
  }

  async createItem(dto: CreateAssetItemDto, user: AuthUser) {
    const category = await this.prisma.assetCategory.findUnique({ where: { id: dto.assetCategoryId } });
    if (!category) throw new NotFoundException("Asset category not found");
    if (dto.locationId && !(await this.prisma.location.findUnique({ where: { id: dto.locationId } }))) {
      throw new NotFoundException("Location not found");
    }
    if (dto.vendorId && !(await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } }))) {
      throw new NotFoundException("Vendor not found");
    }
    const itemCode = dto.itemCode?.trim() || (await this.generateItemCode(category.name));
    const totalQuantity = dto.totalQuantity ?? 0;
    const tenantId = currentTenant().tenantId;

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assetItem.create({
        data: {
          tenantId, itemCode, itemName: dto.itemName, assetCategoryId: dto.assetCategoryId,
          description: dto.description, brand: dto.brand, model: dto.model, unit: dto.unit ?? "unit",
          totalQuantity, reorderLevel: dto.reorderLevel, locationId: dto.locationId, vendorId: dto.vendorId,
          notes: dto.notes, createdById: user.id, updatedById: user.id,
        },
      });
      if (totalQuantity > 0) {
        await tx.assetTransaction.create({
          data: {
            assetItemId: created.id, type: AssetTransactionType.RECEIVED, quantity: totalQuantity,
            userId: user.id, previousValue: 0, newValue: totalQuantity, remarks: "Initial stock on item creation",
          },
        });
      }
      return created;
    });
    await this.audit(user, "asset.item.create", "AssetItem", item.id, { itemCode, totalQuantity });
    return item;
  }

  async updateItem(id: string, dto: UpdateAssetItemDto, user: AuthUser) {
    const item = await this.prisma.assetItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Inventory item not found");
    this.assertCanActItem(user, item);
    if (dto.assetCategoryId && !(await this.prisma.assetCategory.findUnique({ where: { id: dto.assetCategoryId } }))) {
      throw new NotFoundException("Asset category not found");
    }
    if (dto.locationId && !(await this.prisma.location.findUnique({ where: { id: dto.locationId } }))) {
      throw new NotFoundException("Location not found");
    }
    if (dto.vendorId && !(await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } }))) {
      throw new NotFoundException("Vendor not found");
    }
    const updated = await this.prisma.assetItem.update({ where: { id }, data: { ...dto, updatedById: user.id } });
    await this.audit(user, "asset.item.update", "AssetItem", id, dto as Record<string, unknown>);
    return updated;
  }

  async removeItem(id: string, user: AuthUser) {
    const item = await this.itemWithAllocations(id);
    this.assertCanActItem(user, item);
    const stillAllocated = item.allocations.some((a) => a.allocatedQuantity > 0);
    if (stillAllocated) {
      throw new BadRequestException("Cancel this item's school allocations before deleting it");
    }
    await this.prisma.assetItem.delete({ where: { id } });
    await this.audit(user, "asset.item.delete", "AssetItem", id, { itemCode: item.itemCode });
    return { deleted: true };
  }

  async adjustStock(id: string, dto: AdjustStockDto, user: AuthUser) {
    const item = await this.itemWithAllocations(id);
    this.assertCanActItem(user, item);
    const allocated = item.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
    if (dto.newTotalQuantity < allocated) {
      throw new BadRequestException(`Cannot reduce total stock below the ${allocated} units already allocated to schools`);
    }
    const delta = dto.newTotalQuantity - item.totalQuantity;
    await this.prisma.$transaction([
      this.prisma.assetTransaction.create({
        data: {
          assetItemId: id, type: AssetTransactionType.ADJUSTMENT, quantity: delta, remarks: dto.reason,
          userId: user.id, previousValue: item.totalQuantity, newValue: dto.newTotalQuantity,
        },
      }),
      this.prisma.assetItem.update({ where: { id }, data: { totalQuantity: dto.newTotalQuantity, updatedById: user.id } }),
      this.prisma.auditLog.create({
        data: {
          tenantId: currentTenant().tenantId, userId: user.id, action: "asset.item.adjust_stock", entity: "AssetItem", entityId: id,
          metadata: { previous: item.totalQuantity, next: dto.newTotalQuantity, reason: dto.reason },
        },
      }),
    ]);
    return this.itemDetail(id, user);
  }

  async recordMovement(id: string, dto: RecordMovementDto, user: AuthUser) {
    const item = await this.itemWithAllocations(id);
    this.assertCanActItem(user, item);
    const stock = this.computeStock(item);
    const field = dto.type === "RETURN" ? "returnedQuantity" : dto.type === "DAMAGE" ? "damagedQuantity" : "lostQuantity";
    if (dto.type !== "RETURN" && dto.quantity > stock.availableQuantity) {
      throw new BadRequestException(`Only ${stock.availableQuantity} units are available to mark as ${dto.type.toLowerCase()}`);
    }
    const previousValue = item[field];
    const newValue = previousValue + dto.quantity;
    await this.prisma.$transaction([
      this.prisma.assetItem.update({ where: { id }, data: { [field]: newValue, updatedById: user.id } }),
      this.prisma.assetTransaction.create({
        data: {
          assetItemId: id, type: dto.type as AssetTransactionType, quantity: dto.quantity, remarks: dto.remarks,
          userId: user.id, previousValue, newValue,
        },
      }),
    ]);
    await this.audit(user, `asset.item.${dto.type.toLowerCase()}`, "AssetItem", id, { quantity: dto.quantity, remarks: dto.remarks });
    return this.itemDetail(id, user);
  }

  // ────────────────────────── Allocation / Distribution ──────────────────────────

  async allocate(dto: CreateAllocationDto, user: AuthUser) {
    const item = await this.itemWithAllocations(dto.assetItemId);
    this.assertCanActItem(user, item);
    await this.resolveSchool(user, dto.schoolId);
    const stock = this.computeStock(item);
    if (dto.quantity > stock.availableQuantity) {
      throw new BadRequestException(`Only ${stock.availableQuantity} units of "${item.itemName}" are available`);
    }
    const allocation = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.assetAllocation.findUnique({
        where: { assetItemId_schoolId: { assetItemId: dto.assetItemId, schoolId: dto.schoolId } },
      });
      const row = existing
        ? await tx.assetAllocation.update({ where: { id: existing.id }, data: { allocatedQuantity: { increment: dto.quantity } } })
        : await tx.assetAllocation.create({
            data: { assetItemId: dto.assetItemId, schoolId: dto.schoolId, allocatedQuantity: dto.quantity, allocatedById: user.id },
          });
      await tx.assetTransaction.create({
        data: {
          assetItemId: dto.assetItemId, type: AssetTransactionType.ALLOCATION, quantity: dto.quantity, schoolId: dto.schoolId,
          userId: user.id, previousValue: existing?.allocatedQuantity ?? 0, newValue: row.allocatedQuantity,
        },
      });
      return row;
    });
    await this.audit(user, "asset.allocate", "AssetItem", dto.assetItemId, { schoolId: dto.schoolId, quantity: dto.quantity });
    return allocation;
  }

  async cancelAllocation(id: string, user: AuthUser) {
    const allocation = await this.prisma.assetAllocation.findUnique({ where: { id }, include: { assetItem: true } });
    if (!allocation) throw new NotFoundException("Allocation not found");
    this.assertCanActItem(user, allocation.assetItem);
    if (allocation.deliveredQuantity > 0) {
      throw new BadRequestException("This allocation already has delivered units -- record a return instead of cancelling it");
    }
    await this.prisma.$transaction([
      this.prisma.assetTransaction.create({
        data: {
          assetItemId: allocation.assetItemId, type: AssetTransactionType.ALLOCATION_CANCELLED, quantity: -allocation.allocatedQuantity,
          schoolId: allocation.schoolId, userId: user.id, previousValue: allocation.allocatedQuantity, newValue: 0,
        },
      }),
      this.prisma.assetAllocation.delete({ where: { id } }),
    ]);
    await this.audit(user, "asset.allocation_cancel", "AssetItem", allocation.assetItemId, { schoolId: allocation.schoolId });
    return { deleted: true };
  }

  async deliver(id: string, dto: DeliverAllocationDto, user: AuthUser) {
    const allocation = await this.prisma.assetAllocation.findUnique({ where: { id }, include: { assetItem: true } });
    if (!allocation) throw new NotFoundException("Allocation not found");
    this.assertCanActItem(user, allocation.assetItem);
    const remaining = allocation.allocatedQuantity - allocation.deliveredQuantity;
    const quantity = dto.full ? remaining : (dto.quantity ?? 0);
    if (quantity <= 0) throw new BadRequestException("Delivery quantity must be greater than zero");
    if (quantity > remaining) throw new BadRequestException(`Only ${remaining} units are pending delivery for this school`);
    const newDelivered = allocation.deliveredQuantity + quantity;
    const status = newDelivered === allocation.allocatedQuantity ? "DELIVERED" : "PARTIALLY_DELIVERED";
    const type = status === "DELIVERED" ? AssetTransactionType.DISTRIBUTION : AssetTransactionType.PARTIAL_DISTRIBUTION;
    await this.prisma.$transaction([
      this.prisma.assetAllocation.update({ where: { id }, data: { deliveredQuantity: newDelivered, status } }),
      this.prisma.assetTransaction.create({
        data: {
          assetItemId: allocation.assetItemId, type, quantity, schoolId: allocation.schoolId, userId: user.id,
          previousValue: allocation.deliveredQuantity, newValue: newDelivered,
        },
      }),
    ]);
    await this.audit(user, "asset.deliver", "AssetItem", allocation.assetItemId, { schoolId: allocation.schoolId, quantity, status });
    return this.itemDetail(allocation.assetItemId, user);
  }

  async previewDistributionPlan(dto: DistributionPlanPreviewDto, user: AuthUser) {
    const item = await this.itemWithAllocations(dto.assetItemId);
    this.assertCanActItem(user, item);
    const stock = this.computeStock(item);
    const schools = await this.prisma.school.findMany({ where: { id: { in: dto.schoolIds } }, select: { id: true, name: true, code: true } });
    if (schools.length !== new Set(dto.schoolIds).size) throw new NotFoundException("One or more schools not found");

    const base = Math.floor(stock.availableQuantity / schools.length);
    const remainder = stock.availableQuantity % schools.length;
    const proposals = schools.map((s) => ({
      schoolId: s.id, schoolName: s.name, schoolCode: s.code,
      proposedQuantity: dto.mode === "EQUAL" ? base : (dto.manualQuantities?.[s.id] ?? 0),
    }));
    const totalProposed = proposals.reduce((s, p) => s + p.proposedQuantity, 0);

    return {
      itemId: item.id, itemName: item.itemName, itemCode: item.itemCode,
      totalStock: item.totalQuantity, alreadyAllocated: stock.allocatedQuantity, availableStock: stock.availableQuantity,
      schoolCount: schools.length,
      baseQuantityPerSchool: dto.mode === "EQUAL" ? base : null,
      remainder: dto.mode === "EQUAL" ? remainder : null,
      proposals, totalProposed,
      exceedsAvailable: totalProposed > stock.availableQuantity,
    };
  }

  async confirmDistributionPlan(dto: DistributionPlanConfirmDto, user: AuthUser) {
    const item = await this.itemWithAllocations(dto.assetItemId);
    this.assertCanActItem(user, item);
    const stock = this.computeStock(item);
    const rows = dto.allocations.filter((a) => a.quantity > 0);
    const totalRequested = rows.reduce((s, a) => s + a.quantity, 0);
    if (totalRequested > stock.availableQuantity) {
      throw new BadRequestException(`Requested ${totalRequested} units exceeds the ${stock.availableQuantity} available`);
    }
    if (!rows.length) throw new BadRequestException("No schools were given a non-zero quantity");

    const schools = await this.prisma.school.findMany({ where: { id: { in: rows.map((r) => r.schoolId) } } });
    if (schools.length !== rows.length) throw new NotFoundException("One or more schools not found");
    if (!isCrossTenant(user)) {
      const tenantId = currentTenant().tenantId;
      if (schools.some((s) => s.tenantId !== tenantId)) throw new NotFoundException("One or more schools are outside your organization");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const row of rows) {
        const existing = await tx.assetAllocation.findUnique({
          where: { assetItemId_schoolId: { assetItemId: dto.assetItemId, schoolId: row.schoolId } },
        });
        const allocation = existing
          ? await tx.assetAllocation.update({ where: { id: existing.id }, data: { allocatedQuantity: { increment: row.quantity } } })
          : await tx.assetAllocation.create({
              data: { assetItemId: dto.assetItemId, schoolId: row.schoolId, allocatedQuantity: row.quantity, allocatedById: user.id },
            });
        await tx.assetTransaction.create({
          data: {
            assetItemId: dto.assetItemId, type: AssetTransactionType.ALLOCATION, quantity: row.quantity, schoolId: row.schoolId,
            userId: user.id, reference: "distribution-plan", previousValue: existing?.allocatedQuantity ?? 0, newValue: allocation.allocatedQuantity,
          },
        });
        results.push(allocation);
      }
      return results;
    });
    await this.audit(user, "asset.distribution_plan_confirm", "AssetItem", dto.assetItemId, { allocations: rows });
    return { created: created.length, allocations: created };
  }

  // ────────────────────────── School rollups ──────────────────────────

  async schoolsRollup(user: AuthUser) {
    const crossTenant = isCrossTenant(user);
    const schools = await this.prisma.school.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }), tenant: { status: { not: "SUSPENDED" } } },
      select: { id: true, name: true, code: true, institutionType: true },
      orderBy: { name: "asc" },
    });
    const allocations = await this.prisma.assetAllocation.findMany({ where: { schoolId: { in: schools.map((s) => s.id) } } });
    return schools.map((s) => {
      const rows = allocations.filter((a) => a.schoolId === s.id);
      const allocated = rows.reduce((sum, a) => sum + a.allocatedQuantity, 0);
      const delivered = rows.reduce((sum, a) => sum + a.deliveredQuantity, 0);
      const pending = allocated - delivered;
      const status = rows.length === 0 ? "NONE" : pending === 0 ? "FULLY_DELIVERED" : delivered === 0 ? "PENDING" : "PARTIAL";
      return { ...s, totalItems: rows.length, allocated, delivered, pending, status };
    });
  }

  async schoolDetail(schoolId: string, user: AuthUser) {
    const school = await this.resolveSchool(user, schoolId);
    const allocations = await this.prisma.assetAllocation.findMany({
      where: { schoolId },
      include: { assetItem: { include: { assetCategory: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return { school, allocations };
  }

  // ────────────────────────── Dashboard + reports ──────────────────────────

  async dashboard(user: AuthUser) {
    const crossTenant = isCrossTenant(user);
    const items = await this.prisma.assetItem.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }) },
      include: { allocations: true },
    });
    const withStock = items.map((i) => this.computeStock(i));
    const schoolIds = new Set(items.flatMap((i) => i.allocations.map((a) => a.schoolId)));
    return {
      totalItems: items.length,
      totalStock: items.reduce((s, i) => s + i.totalQuantity, 0),
      totalAvailable: withStock.reduce((s, i) => s + i.availableQuantity, 0),
      totalAllocated: withStock.reduce((s, i) => s + i.allocatedQuantity, 0),
      totalDelivered: withStock.reduce((s, i) => s + i.deliveredQuantity, 0),
      totalPending: withStock.reduce((s, i) => s + i.pendingQuantity, 0),
      lowStock: withStock.filter((i) => i.reorderLevel != null && i.availableQuantity <= i.reorderLevel).length,
      schoolsWithAllocation: schoolIds.size,
    };
  }

  async inventoryCsv(user: AuthUser): Promise<string> {
    const items = await this.listItems(user, {});
    const header = "Item Code,Item Name,Category,Location,Vendor,Total,Allocated,Delivered,Available,Status\n";
    const rows = items
      .map((i: any) =>
        [i.itemCode, i.itemName, i.assetCategory?.name ?? "", i.location?.name ?? "", i.vendor?.name ?? "", i.totalQuantity, i.allocatedQuantity, i.deliveredQuantity, i.availableQuantity, i.status]
          .map(csvEscape)
          .join(","),
      )
      .join("\n");
    return header + rows;
  }

  async distributionMatrix(user: AuthUser) {
    const crossTenant = isCrossTenant(user);
    const schools = await this.prisma.school.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }) },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    const items = await this.prisma.assetItem.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }) },
      include: { assetCategory: { select: { id: true, name: true } }, allocations: true },
      orderBy: { itemName: "asc" },
    });
    return {
      schools,
      items: items.map((i) => ({
        id: i.id, itemName: i.itemName, itemCode: i.itemCode, category: i.assetCategory.name,
        cells: schools.map((s) => {
          const a = i.allocations.find((al) => al.schoolId === s.id);
          return { schoolId: s.id, allocated: a?.allocatedQuantity ?? 0, delivered: a?.deliveredQuantity ?? 0 };
        }),
      })),
    };
  }

  async distributionMatrixCsv(user: AuthUser): Promise<string> {
    const crossTenant = isCrossTenant(user);
    const schools = await this.prisma.school.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const items = await this.prisma.assetItem.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }) },
      include: { allocations: true },
    });
    const header = ["Item", ...schools.map((s) => s.name)].map(csvEscape).join(",") + "\n";
    const rows = items
      .map((i) => {
        const cells = schools.map((s) => {
          const a = i.allocations.find((al) => al.schoolId === s.id);
          return a ? `${a.allocatedQuantity} (${a.deliveredQuantity} delivered)` : "";
        });
        return [i.itemName, ...cells].map(csvEscape).join(",");
      })
      .join("\n");
    return header + rows;
  }
}
