-- Department becomes a global shared catalog (like Subject) -- one flat
-- list of names used identically across every school/institute/college/
-- center, instead of one duplicate row per school. Dedupes existing rows
-- by name (keeping the lowest id per name as canonical), repoints any
-- TaskDepartment references to survive the dedupe, then drops the
-- tenantId/schoolId columns and makes name globally unique.
--
-- Must run AFTER 20260809000000_task_multi_department_assignee (this one
-- repoints TaskDepartment rows that migration creates) -- safe to re-run,
-- and safe even if that migration hasn't been run yet (the TaskDepartment
-- steps below no-op if the table doesn't exist).

DO $$
DECLARE
  has_task_department boolean := to_regclass('"TaskDepartment"') IS NOT NULL;
BEGIN
  IF has_task_department THEN
    -- Repoint TaskDepartment rows off duplicate departments onto the
    -- canonical (lowest id) row for that name, skipping any repoint that
    -- would collide with an existing (taskId, canonicalId) row.
    UPDATE "TaskDepartment" td
    SET "departmentId" = canon.canonical_id
    FROM (
      SELECT d.id, c.canonical_id
      FROM "Department" d
      JOIN (SELECT name, MIN(id) AS canonical_id FROM "Department" GROUP BY name) c ON c.name = d.name
      WHERE d.id <> c.canonical_id
    ) canon
    WHERE td."departmentId" = canon.id
      AND NOT EXISTS (
        SELECT 1 FROM "TaskDepartment" td2
        WHERE td2."taskId" = td."taskId" AND td2."departmentId" = canon.canonical_id
      );

    -- Anything left still pointing at a duplicate means the task already
    -- had both rows linked -- drop the now-redundant duplicate link.
    DELETE FROM "TaskDepartment" td
    USING "Department" d,
      (SELECT name, MIN(id) AS canonical_id FROM "Department" GROUP BY name) c
    WHERE td."departmentId" = d.id AND d.name = c.name AND d.id <> c.canonical_id;
  END IF;
END $$;

-- Delete duplicate Department rows, keeping the canonical (lowest id) one
-- per distinct name.
DELETE FROM "Department" d
USING (SELECT name, MIN(id) AS canonical_id FROM "Department" GROUP BY name) c
WHERE d.name = c.name AND d.id <> c.canonical_id;

DROP INDEX IF EXISTS "Department_tenantId_idx";
DROP INDEX IF EXISTS "Department_schoolId_name_key";
ALTER TABLE "Department" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Department" DROP COLUMN IF EXISTS "schoolId";

CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");
