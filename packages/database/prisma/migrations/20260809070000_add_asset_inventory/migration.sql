-- Asset Management / Inventory system: promotes Asset Category, Vendor and
-- Location from the generic-scaffold GenericRecord table to real global
-- catalogs (same pattern as Department), and adds AssetItem/AssetAllocation/
-- AssetTransaction for the full Category -> Item -> Stock -> School
-- Allocation -> Distribution chain. Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "AssetCategory" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isArchived"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssetCategory_name_key" ON "AssetCategory"("name");

CREATE TABLE IF NOT EXISTS "Vendor" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone"         TEXT,
    "email"         TEXT,
    "address"       TEXT,
    "notes"         TEXT,
    "isArchived"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_name_key" ON "Vendor"("name");

CREATE TABLE IF NOT EXISTS "Location" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isArchived"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Location_name_key" ON "Location"("name");

CREATE TABLE IF NOT EXISTS "AssetItem" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "itemCode"         TEXT NOT NULL,
    "itemName"         TEXT NOT NULL,
    "assetCategoryId"  TEXT NOT NULL,
    "description"      TEXT,
    "brand"            TEXT,
    "model"            TEXT,
    "unit"             TEXT NOT NULL DEFAULT 'unit',
    "totalQuantity"    INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity"  INTEGER NOT NULL DEFAULT 0,
    "lostQuantity"     INTEGER NOT NULL DEFAULT 0,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel"     INTEGER,
    "locationId"       TEXT,
    "vendorId"         TEXT,
    "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes"            TEXT,
    "sourceFile"       TEXT,
    "sourceItemName"   TEXT,
    "importNotes"      TEXT,
    "createdById"      TEXT NOT NULL,
    "updatedById"      TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssetItem_itemCode_key" ON "AssetItem"("itemCode");
CREATE INDEX IF NOT EXISTS "AssetItem_tenantId_assetCategoryId_idx" ON "AssetItem"("tenantId", "assetCategoryId");

DO $$ BEGIN
  ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetItem" ADD CONSTRAINT "AssetItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AssetAllocationStatus" AS ENUM ('PENDING', 'PARTIALLY_DELIVERED', 'DELIVERED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AssetAllocation" (
    "id"                TEXT NOT NULL,
    "assetItemId"       TEXT NOT NULL,
    "schoolId"          TEXT NOT NULL,
    "allocatedQuantity" INTEGER NOT NULL,
    "deliveredQuantity" INTEGER NOT NULL DEFAULT 0,
    "status"            "AssetAllocationStatus" NOT NULL DEFAULT 'PENDING',
    "allocatedById"     TEXT NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssetAllocation_assetItemId_schoolId_key" ON "AssetAllocation"("assetItemId", "schoolId");
CREATE INDEX IF NOT EXISTS "AssetAllocation_schoolId_idx" ON "AssetAllocation"("schoolId");

DO $$ BEGIN
  ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_assetItemId_fkey" FOREIGN KEY ("assetItemId") REFERENCES "AssetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AssetTransactionType" AS ENUM ('RECEIVED', 'ADJUSTMENT', 'ALLOCATION', 'ALLOCATION_CANCELLED', 'DISTRIBUTION', 'PARTIAL_DISTRIBUTION', 'RETURN', 'DAMAGE', 'LOST', 'TRANSFER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AssetTransaction" (
    "id"            TEXT NOT NULL,
    "assetItemId"   TEXT NOT NULL,
    "type"          "AssetTransactionType" NOT NULL,
    "quantity"      INTEGER NOT NULL,
    "schoolId"      TEXT,
    "reference"     TEXT,
    "remarks"       TEXT,
    "userId"        TEXT NOT NULL,
    "previousValue" INTEGER,
    "newValue"      INTEGER,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssetTransaction_assetItemId_createdAt_idx" ON "AssetTransaction"("assetItemId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AssetTransaction" ADD CONSTRAINT "AssetTransaction_assetItemId_fkey" FOREIGN KEY ("assetItemId") REFERENCES "AssetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetTransaction" ADD CONSTRAINT "AssetTransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AssetTransaction" ADD CONSTRAINT "AssetTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Backfill: promote the 2 existing GenericRecord "assets-asset-category" rows
-- (created via the old generic scaffold, incidentally scoped to whichever
-- school happened to be selected at the time) into the new global catalog.
-- Existing category names are preserved verbatim, never renamed.
INSERT INTO "AssetCategory" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, (gr.data->>'name'), gr."createdAt", gr."updatedAt"
FROM "GenericRecord" gr
WHERE gr.module = 'assets-asset-category' AND (gr.data->>'name') IS NOT NULL
ON CONFLICT ("name") DO NOTHING;
