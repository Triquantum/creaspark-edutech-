-- Task Manager: support multiple departments and multiple assignees per
-- task, replacing the single departmentId/assignedToId FKs on TaskItem
-- with join tables (TaskDepartment, TaskAssignee) -- same explicit-join
-- convention as UserAccess/TeacherAssignment/ExamSubject rather than
-- Prisma's implicit m2m. Existing single-value rows are backfilled into
-- the join tables before the old columns are dropped. Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "TaskDepartment" (
    "id"           TEXT NOT NULL,
    "taskId"       TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "TaskDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaskAssignee" (
    "id"     TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "TaskDepartment" ADD CONSTRAINT "TaskDepartment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskDepartment" ADD CONSTRAINT "TaskDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskDepartment" ADD CONSTRAINT "TaskDepartment_taskId_departmentId_key" UNIQUE ("taskId", "departmentId");
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "TaskDepartment_departmentId_idx" ON "TaskDepartment"("departmentId");

DO $$ BEGIN
  ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_userId_key" UNIQUE ("taskId", "userId");
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- Backfill: every existing task's single departmentId/assignedToId becomes
-- its first (and so far only) join-table row. ON CONFLICT guards re-runs.
INSERT INTO "TaskDepartment" ("id", "taskId", "departmentId")
SELECT gen_random_uuid()::text, t."id", t."departmentId"
FROM "TaskItem" t
WHERE t."departmentId" IS NOT NULL
ON CONFLICT ("taskId", "departmentId") DO NOTHING;

INSERT INTO "TaskAssignee" ("id", "taskId", "userId")
SELECT gen_random_uuid()::text, t."id", t."assignedToId"
FROM "TaskItem" t
WHERE t."assignedToId" IS NOT NULL
ON CONFLICT ("taskId", "userId") DO NOTHING;

-- Drop the old single-value columns now that every row has a join-table
-- equivalent.
DROP INDEX IF EXISTS "TaskItem_tenantId_assignedToId_idx";
ALTER TABLE "TaskItem" DROP CONSTRAINT IF EXISTS "TaskItem_departmentId_fkey";
ALTER TABLE "TaskItem" DROP CONSTRAINT IF EXISTS "TaskItem_assignedToId_fkey";
ALTER TABLE "TaskItem" DROP COLUMN IF EXISTS "departmentId";
ALTER TABLE "TaskItem" DROP COLUMN IF EXISTS "assignedToId";
