-- Dedicated Leave module (LeaveType/LeaveBalance/LeaveApplication),
-- replacing the generic catch-all scaffold previously used at
-- /leave/leave-category, /leave/leave-assign, /leave/leave-apply, and
-- /leave/leave-applications -- that scaffold had no per-user or per-school
-- scoping, so any staff member could see, edit, and delete every other
-- staff member's leave application tenant-wide. Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "LeaveApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LeaveType" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "daysPerYear" INTEGER,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeaveType_tenantId_name_key" ON "LeaveType"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "LeaveType_tenantId_idx" ON "LeaveType"("tenantId");

CREATE TABLE IF NOT EXISTS "LeaveBalance" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "leaveTypeId"  TEXT NOT NULL,
    "year"         INTEGER NOT NULL,
    "allotted"     INTEGER NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "LeaveBalance_userId_leaveTypeId_year_key" ON "LeaveBalance"("userId", "leaveTypeId", "year");
CREATE INDEX IF NOT EXISTS "LeaveBalance_tenantId_idx" ON "LeaveBalance"("tenantId");

CREATE TABLE IF NOT EXISTS "LeaveApplication" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "schoolId"      TEXT,
    "applicantId"   TEXT NOT NULL,
    "leaveTypeId"   TEXT NOT NULL,
    "fromDate"      DATE NOT NULL,
    "toDate"        DATE NOT NULL,
    "days"          INTEGER NOT NULL,
    "reason"        TEXT NOT NULL,
    "status"        "LeaveApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById"  TEXT,
    "reviewRemarks" TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeaveApplication_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "LeaveApplication_tenantId_applicantId_idx" ON "LeaveApplication"("tenantId", "applicantId");
CREATE INDEX IF NOT EXISTS "LeaveApplication_tenantId_schoolId_status_idx" ON "LeaveApplication"("tenantId", "schoolId", "status");
