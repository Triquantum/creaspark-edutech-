-- Yearly Plan (curriculum): global catalog authored once, applies across
-- every client school, same pattern as AssetCategory/Vendor/Location.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "YearlyPlanGrade" (
    "id"           TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "gradeLabel"   TEXT NOT NULL,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "sourceFile"   TEXT,
    "createdById"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YearlyPlanGrade_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "YearlyPlanGrade_academicYear_gradeLabel_key" ON "YearlyPlanGrade"("academicYear", "gradeLabel");
DO $$ BEGIN
  ALTER TABLE "YearlyPlanGrade" ADD CONSTRAINT "YearlyPlanGrade_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "YearlyPlanEntry" (
    "id"              TEXT NOT NULL,
    "gradeId"         TEXT NOT NULL,
    "rowIndex"        INTEGER NOT NULL,
    "term"            TEXT,
    "month"           TEXT,
    "week"            TEXT,
    "workingDays"     INTEGER,
    "instructedDays"  INTEGER,
    "subject"         TEXT,
    "unitChapter"     TEXT,
    "learningOutcome" TEXT,
    "activity"        TEXT,
    "sdgMapping"      TEXT,
    "skills"          TEXT,
    "values"          TEXT,
    "digitalContent"  TEXT,
    "assessment"      TEXT,
    "remarks"         TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YearlyPlanEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "YearlyPlanEntry_gradeId_rowIndex_idx" ON "YearlyPlanEntry"("gradeId", "rowIndex");
DO $$ BEGIN
  ALTER TABLE "YearlyPlanEntry" ADD CONSTRAINT "YearlyPlanEntry_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "YearlyPlanGrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
