-- Training/FDP: add targetClassIds so a training can be scoped to specific
-- grades/classes -- narrowing the attendance/notification audience to only
-- teachers assigned (via TeacherAssignment) to those classes.
-- Empty array (the default) means "all classes", matching the existing
-- targetRoles "empty = everyone" convention.
-- Additive only. Safe to re-run.

ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "targetClassIds" TEXT[] NOT NULL DEFAULT '{}';
