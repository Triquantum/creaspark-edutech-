-- Which school + teacher is responsible for delivering a Yearly Plan
-- grade's content. Safe to re-run.

CREATE TABLE IF NOT EXISTS "YearlyPlanAssignment" (
    "id"        TEXT NOT NULL,
    "gradeId"   TEXT NOT NULL,
    "schoolId"  TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YearlyPlanAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "YearlyPlanAssignment_gradeId_schoolId_teacherId_key" ON "YearlyPlanAssignment"("gradeId", "schoolId", "teacherId");
CREATE INDEX IF NOT EXISTS "YearlyPlanAssignment_schoolId_idx" ON "YearlyPlanAssignment"("schoolId");
CREATE INDEX IF NOT EXISTS "YearlyPlanAssignment_teacherId_idx" ON "YearlyPlanAssignment"("teacherId");
DO $$ BEGIN
  ALTER TABLE "YearlyPlanAssignment" ADD CONSTRAINT "YearlyPlanAssignment_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "YearlyPlanGrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "YearlyPlanAssignment" ADD CONSTRAINT "YearlyPlanAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "YearlyPlanAssignment" ADD CONSTRAINT "YearlyPlanAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
