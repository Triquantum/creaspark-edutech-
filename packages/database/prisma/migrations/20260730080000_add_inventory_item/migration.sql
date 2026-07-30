-- Physical stock tracked and distributed to a specific school/college/institute.

CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "imageUrl" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remarks" TEXT,
  "comments" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryItem_tenantId_schoolId_submittedAt_idx" ON "InventoryItem"("tenantId", "schoolId", "submittedAt");
