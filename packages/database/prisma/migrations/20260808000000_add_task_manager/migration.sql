-- Task Manager: standalone work-assignment tracker between users. Unrelated
-- to PortionReport -- this is one person assigning a task to another and
-- tracking it to completion via TaskItem. Safe to re-run: every step is
-- idempotent.

-- Step 1: enum + serial-number sequence.
DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE SEQUENCE IF NOT EXISTS "task_serial_seq" START 1;

-- Step 2: the table itself.
CREATE TABLE IF NOT EXISTS "TaskItem" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "schoolId"     TEXT NOT NULL,
    "serialNo"     TEXT NOT NULL DEFAULT ('TASK-' || lpad(nextval('task_serial_seq')::text, 6, '0')),
    "subject"      TEXT NOT NULL,
    "description"  TEXT,
    "departmentId" TEXT NOT NULL,
    "targetDate"   DATE,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "updatedById"  TEXT,
    "remarks"      TEXT,
    "status"       "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskItem_pkey" PRIMARY KEY ("id")
);

-- Step 3: constraints + indexes.
DO $$ BEGIN
  ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_serialNo_key" UNIQUE ("serialNo");
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "TaskItem_tenantId_schoolId_status_idx" ON "TaskItem"("tenantId", "schoolId", "status");
CREATE INDEX IF NOT EXISTS "TaskItem_tenantId_assignedToId_idx" ON "TaskItem"("tenantId", "assignedToId");
CREATE INDEX IF NOT EXISTS "TaskItem_tenantId_assignedById_idx" ON "TaskItem"("tenantId", "assignedById");
