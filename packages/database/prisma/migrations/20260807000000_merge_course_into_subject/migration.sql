-- Merge Course into Subject: Lesson/Assignment/Quiz now scope directly to
-- (subjectId, schoolId, classId, teacherId) instead of a separate Course
-- row, and each publishes independently via its own "status" instead of
-- one shared course-level status. Existing rows are backfilled from their
-- current Course before courseId is dropped and Course itself is removed,
-- so no lesson/assignment/quiz/submission/attempt data is lost.
-- Safe to re-run: every step is idempotent.

-- Step 0: new enum for per-item publish status.
DO $$ BEGIN
  CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 1: add the new scoping columns (nullable for now, populated next).
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "status" "ContentStatus";

ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "status" "ContentStatus";

ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "status" "ContentStatus";

-- Step 2: backfill from the Course each row currently points to. Only runs
-- if Course still exists (guards a re-run after Step 7 already dropped it).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Course') THEN
    UPDATE "Lesson" l SET
      "subjectId" = c."subjectId", "schoolId" = c."schoolId", "classId" = c."classId",
      "teacherId" = c."teacherId", "status" = c."status"::text::"ContentStatus"
    FROM "Course" c WHERE l."courseId" = c."id" AND l."schoolId" IS NULL;

    UPDATE "Assignment" a SET
      "subjectId" = c."subjectId", "schoolId" = c."schoolId", "classId" = c."classId",
      "teacherId" = c."teacherId", "status" = c."status"::text::"ContentStatus"
    FROM "Course" c WHERE a."courseId" = c."id" AND a."schoolId" IS NULL;

    UPDATE "Quiz" q SET
      "subjectId" = c."subjectId", "schoolId" = c."schoolId", "classId" = c."classId",
      "teacherId" = c."teacherId", "status" = c."status"::text::"ContentStatus"
    FROM "Course" c WHERE q."courseId" = c."id" AND q."schoolId" IS NULL;
  END IF;
END $$;

-- Safety net: any row that still has no status after backfill (shouldn't
-- happen -- every Course has a NOT NULL status) defaults to DRAFT rather
-- than blocking the NOT NULL constraint below.
UPDATE "Lesson" SET "status" = 'DRAFT' WHERE "status" IS NULL;
UPDATE "Assignment" SET "status" = 'DRAFT' WHERE "status" IS NULL;
UPDATE "Quiz" SET "status" = 'DRAFT' WHERE "status" IS NULL;

-- Step 3: enforce NOT NULL on the columns every row must always carry
-- (subjectId/classId stay nullable, matching Course's own optionality
-- there -- whole-school content, or content not yet tied to a subject).
ALTER TABLE "Lesson" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "teacherId" SET NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Assignment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Assignment" ALTER COLUMN "teacherId" SET NOT NULL;
ALTER TABLE "Assignment" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Assignment" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Quiz" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Quiz" ALTER COLUMN "teacherId" SET NOT NULL;
ALTER TABLE "Quiz" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Quiz" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Step 4: foreign keys + indexes for the new columns.
DO $$ BEGIN
  ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "Lesson_tenantId_subjectId_schoolId_classId_order_idx" ON "Lesson"("tenantId", "subjectId", "schoolId", "classId", "order");
CREATE INDEX IF NOT EXISTS "Lesson_tenantId_teacherId_idx" ON "Lesson"("tenantId", "teacherId");

CREATE INDEX IF NOT EXISTS "Assignment_tenantId_subjectId_schoolId_classId_idx" ON "Assignment"("tenantId", "subjectId", "schoolId", "classId");
CREATE INDEX IF NOT EXISTS "Assignment_tenantId_teacherId_idx" ON "Assignment"("tenantId", "teacherId");

CREATE INDEX IF NOT EXISTS "Quiz_tenantId_subjectId_schoolId_classId_idx" ON "Quiz"("tenantId", "subjectId", "schoolId", "classId");
CREATE INDEX IF NOT EXISTS "Quiz_tenantId_teacherId_idx" ON "Quiz"("tenantId", "teacherId");

-- Step 5: drop the old courseId column (and its FK/index) now that every
-- row carries the new scoping columns instead.
ALTER TABLE "Lesson" DROP CONSTRAINT IF EXISTS "Lesson_courseId_fkey";
DROP INDEX IF EXISTS "Lesson_tenantId_courseId_order_idx";
ALTER TABLE "Lesson" DROP COLUMN IF EXISTS "courseId";

ALTER TABLE "Assignment" DROP CONSTRAINT IF EXISTS "Assignment_courseId_fkey";
DROP INDEX IF EXISTS "Assignment_tenantId_courseId_idx";
ALTER TABLE "Assignment" DROP COLUMN IF EXISTS "courseId";

ALTER TABLE "Quiz" DROP CONSTRAINT IF EXISTS "Quiz_courseId_fkey";
DROP INDEX IF EXISTS "Quiz_tenantId_courseId_idx";
ALTER TABLE "Quiz" DROP COLUMN IF EXISTS "courseId";

-- Step 6: create SubjectView (replaces CourseView) and copy its data over.
CREATE TABLE IF NOT EXISTS "SubjectView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "studentId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectView_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CourseView') THEN
    INSERT INTO "SubjectView" ("id", "tenantId", "subjectId", "schoolId", "classId", "studentId", "viewedAt")
    SELECT cv."id", cv."tenantId", c."subjectId", c."schoolId", c."classId", cv."studentId", cv."viewedAt"
    FROM "CourseView" cv
    JOIN "Course" c ON c."id" = cv."courseId"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "SubjectView" ADD CONSTRAINT "SubjectView_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SubjectView" ADD CONSTRAINT "SubjectView_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SubjectView" ADD CONSTRAINT "SubjectView_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SubjectView" ADD CONSTRAINT "SubjectView_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "SubjectView_tenantId_subjectId_schoolId_classId_studentId_idx" ON "SubjectView"("tenantId", "subjectId", "schoolId", "classId", "studentId");

-- Step 7: drop the now-decoupled legacy tables + unused enum. CourseView
-- must go first (its FK points at Course).
DROP TABLE IF EXISTS "CourseView";
DROP TABLE IF EXISTS "Course";
DROP TYPE IF EXISTS "CourseStatus";
