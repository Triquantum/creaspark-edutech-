-- Portion Status: teacher-facing "Remarks" field on the submission form,
-- distinct from the existing reviewer-side reviewRemarks field.
-- Additive only. Safe to re-run.

ALTER TABLE "PortionReport" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
