-- Portion Status: new "Project status" tracker (Not Started / In Progress /
-- Completed), independent of the existing Portion status field.
-- Additive only. Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "PortionReport" ADD COLUMN IF NOT EXISTS "projectStatus" "ProjectStatus";
