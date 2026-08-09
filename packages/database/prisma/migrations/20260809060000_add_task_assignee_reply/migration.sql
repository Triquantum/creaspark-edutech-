-- Each TaskAssignee tracks its own reply (status/remarks/respondedAt),
-- independent of TaskItem.status, so a manager can see who has replied to a
-- multi-assignee task and who is still pending. Safe to re-run.

ALTER TABLE "TaskAssignee" ADD COLUMN IF NOT EXISTS "status" "TaskStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "TaskAssignee" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
ALTER TABLE "TaskAssignee" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
