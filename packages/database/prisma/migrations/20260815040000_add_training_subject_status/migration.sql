-- Training/FDP: add a free-text "subject" field and a status lifecycle
-- (Scheduled/Ongoing/Completed/Cancelled) to Training.
-- Additive only. Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "TrainingStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "status" "TrainingStatus" NOT NULL DEFAULT 'SCHEDULED';
