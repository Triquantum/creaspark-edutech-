-- UserAccess: lets a staff member hold several (school, role, designation)
-- grants at once -- e.g. School Admin at School A and Teacher at School B.
-- StaffProfile stays as the mirror of whichever grant is isPrimary, so
-- every existing module reading StaffProfile/User.role is unaffected.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "UserAccess" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "schoolId"    TEXT,
    "role"        "Role" NOT NULL,
    "designation" TEXT,
    "department"  TEXT,
    "employeeNo"  TEXT,
    "isPrimary"   BOOLEAN NOT NULL DEFAULT false,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAccess_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "UserAccess" ADD CONSTRAINT "UserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "UserAccess" ADD CONSTRAINT "UserAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "UserAccess" ADD CONSTRAINT "UserAccess_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "UserAccess" ADD CONSTRAINT "UserAccess_userId_tenantId_schoolId_role_key" UNIQUE ("userId", "tenantId", "schoolId", "role");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "UserAccess_userId_idx" ON "UserAccess"("userId");
CREATE INDEX IF NOT EXISTS "UserAccess_tenantId_schoolId_role_idx" ON "UserAccess"("tenantId", "schoolId", "role");

-- Partial unique indexes -- Prisma's schema can't express a WHERE clause on
-- @@unique, so these are hand-written same as every other constraint in
-- this migration convention.
CREATE UNIQUE INDEX IF NOT EXISTS "user_access_one_primary_idx" ON "UserAccess" ("userId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "user_access_school_empno_idx" ON "UserAccess" ("schoolId", "employeeNo") WHERE "employeeNo" IS NOT NULL;

-- Backfill: every existing staff User + StaffProfile pair becomes its one
-- primary grant. SUPER_ADMIN is excluded -- it already bypasses all grant
-- checks platform-wide and doesn't need a row here. ON CONFLICT guards
-- re-runs and any grant a prior partial run already inserted.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "UserAccess" ("id", "userId", "tenantId", "schoolId", "role", "designation", "department", "employeeNo", "isPrimary", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", u."tenantId", sp."schoolId", u."role", sp."designation", sp."department", sp."employeeNo",
       true, u."isActive", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
JOIN "StaffProfile" sp ON sp."userId" = u."id"
WHERE u."role" != 'SUPER_ADMIN'
ON CONFLICT ("userId", "tenantId", "schoolId", "role") DO NOTHING;
