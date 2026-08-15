-- Training/FDP: expand Training with venue/duration/resourcePerson/agenda,
-- and add TrainingAttendance for per-person attendance marking.
-- Additive only. Safe to re-run.

ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "venue" TEXT;
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "duration" TEXT;
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "resourcePerson" TEXT;
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "agenda" TEXT;

CREATE TABLE IF NOT EXISTS "TrainingAttendance" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "present"    BOOLEAN NOT NULL DEFAULT true,
    "markedById" TEXT NOT NULL,
    "markedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingAttendance_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_trainingId_userId_key" UNIQUE ("trainingId", "userId");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "TrainingAttendance_tenantId_trainingId_idx" ON "TrainingAttendance"("tenantId", "trainingId");
