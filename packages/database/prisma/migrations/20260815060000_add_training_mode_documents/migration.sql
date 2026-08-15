-- Training/FDP: add a mode (Online/Offline) and optional supporting
-- document attachments to Training.
-- Additive only. Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "TrainingMode" AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "mode" "TrainingMode" NOT NULL DEFAULT 'OFFLINE';
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "documentUrls" TEXT[] NOT NULL DEFAULT '{}';
