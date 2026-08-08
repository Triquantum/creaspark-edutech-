-- Task Manager: drop the School scoping from TaskItem. The table is brand
-- new (created by the prior migration, 0 rows in production as of this
-- writing) so this is a plain, safe column drop -- no backfill needed.

DROP INDEX IF EXISTS "TaskItem_tenantId_schoolId_status_idx";

ALTER TABLE "TaskItem" DROP CONSTRAINT IF EXISTS "TaskItem_schoolId_fkey";
ALTER TABLE "TaskItem" DROP COLUMN IF EXISTS "schoolId";

CREATE INDEX IF NOT EXISTS "TaskItem_tenantId_status_idx" ON "TaskItem"("tenantId", "status");
