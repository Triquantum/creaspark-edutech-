-- StaffProfile: employmentType (Permanent/Temporary) and salaryPaidBy
-- (Company/School). Existing rows backfill to the defaults automatically.
-- Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'TEMPORARY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryPaidBy" AS ENUM ('COMPANY', 'SCHOOL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT';
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "salaryPaidBy" "SalaryPaidBy" NOT NULL DEFAULT 'SCHOOL';
