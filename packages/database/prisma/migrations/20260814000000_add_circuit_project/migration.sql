-- Circuit Lab: virtual circuit simulation (Wokwi embed + PICSimLab embed).
-- New table only, no changes to existing tables. Safe to re-run — idempotent.

DO $$ BEGIN
  CREATE TYPE "CircuitSimulator" AS ENUM ('WOKWI', 'PICSIMLAB');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "CircuitProject" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "schoolId"     TEXT NOT NULL,
    "classId"      TEXT,
    "subjectId"    TEXT,
    "studentId"    TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "simulator"    "CircuitSimulator" NOT NULL,
    "projectUrl"   TEXT,
    "notes"        TEXT,
    "reviewedById" TEXT,
    "feedback"     TEXT,
    "reviewedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CircuitProject_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CircuitProject" ADD CONSTRAINT "CircuitProject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CircuitProject" ADD CONSTRAINT "CircuitProject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CircuitProject" ADD CONSTRAINT "CircuitProject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CircuitProject" ADD CONSTRAINT "CircuitProject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "CircuitProject_tenantId_studentId_idx" ON "CircuitProject"("tenantId", "studentId");
CREATE INDEX IF NOT EXISTS "CircuitProject_tenantId_schoolId_classId_idx" ON "CircuitProject"("tenantId", "schoolId", "classId");
