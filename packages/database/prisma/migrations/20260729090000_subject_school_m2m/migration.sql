-- Subject.schoolIdRef (single school, one row per school) is replaced by a
-- proper many-to-many `_SchoolToSubject` join table, so one Subject row can
-- be toggled onto several schools/colleges/institutes at once. Existing
-- duplicate rows (same subject created once per school) are auto-merged by
-- (name, code) into a single canonical row, per user's confirmed choice.

-- 1) Create the implicit m2m join table Prisma expects for `Subject.schools <-> School.subjects`.
CREATE TABLE IF NOT EXISTS "_SchoolToSubject" (
  "A" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "B" TEXT NOT NULL REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "_SchoolToSubject_AB_unique" ON "_SchoolToSubject"("A", "B");
CREATE INDEX IF NOT EXISTS "_SchoolToSubject_B_index" ON "_SchoolToSubject"("B");

-- 2) Backfill the join table from the old single-school pointer.
INSERT INTO "_SchoolToSubject" ("A", "B")
SELECT s."schoolIdRef", s.id FROM "Subject" s
WHERE s."schoolIdRef" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) Compute the canonical (kept) row per duplicate group, purely by
--    (name, code) — NOT tenantId, since the whole point is merging the same
--    subject across different schools/tenants into one shared catalog entry.
CREATE TEMP TABLE subject_canonical AS
SELECT name, COALESCE(code, '') AS code_key, MIN(id) AS canonical_id
FROM "Subject"
GROUP BY name, COALESCE(code, '');

CREATE TEMP TABLE subject_map AS
SELECT s.id AS old_id, c.canonical_id
FROM "Subject" s
JOIN subject_canonical c ON s.name = c.name AND COALESCE(s.code, '') = c.code_key
WHERE s.id <> c.canonical_id;

-- 4) Merge duplicates' school assignments into the canonical row's join rows.
INSERT INTO "_SchoolToSubject" ("A", "B")
SELECT j."A", m.canonical_id
FROM "_SchoolToSubject" j
JOIN subject_map m ON j."B" = m.old_id
ON CONFLICT DO NOTHING;

-- 5) Repoint dependent FKs to the canonical subject.
--    TeacherAssignment has a UNIQUE(sectionId, subjectId) — drop a duplicate's
--    assignment first if the canonical subject is already assigned to that
--    section, otherwise the UPDATE below would violate the constraint.
DELETE FROM "TeacherAssignment" ta
USING subject_map m
WHERE ta."subjectId" = m.old_id
  AND EXISTS (
    SELECT 1 FROM "TeacherAssignment" ta2
    WHERE ta2."sectionId" = ta."sectionId" AND ta2."subjectId" = m.canonical_id
  );

UPDATE "TeacherAssignment" ta SET "subjectId" = m.canonical_id
FROM subject_map m WHERE ta."subjectId" = m.old_id;

UPDATE "PortionReport" pr SET "subjectId" = m.canonical_id
FROM subject_map m WHERE pr."subjectId" = m.old_id;

UPDATE "Course" c SET "subjectId" = m.canonical_id
FROM subject_map m WHERE c."subjectId" = m.old_id;

UPDATE "ExamSubject" es SET "subjectId" = m.canonical_id
FROM subject_map m WHERE es."subjectId" = m.old_id;

-- 6) Delete the now-redundant duplicate Subject rows (cascades clean up
--    their leftover join-table rows automatically).
DELETE FROM "Subject" s USING subject_map m WHERE s.id = m.old_id;

DROP TABLE subject_canonical;
DROP TABLE subject_map;

-- 7) Drop the old single-school pointer column.
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "schoolIdRef";
