-- Training & Feedback: Super Admin conducts a training targeted at a
-- chosen audience (roles and/or a single school); the matched audience
-- each submit one structured feedback response. Safe to re-run.

CREATE TABLE IF NOT EXISTS "Training" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "conductedAt"    TIMESTAMP(3) NOT NULL,
    "conductedById"  TEXT NOT NULL,
    "targetRoles"    "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[],
    "targetSchoolId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingFeedback" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "trainingId"       TEXT NOT NULL,
    "respondentId"     TEXT NOT NULL,
    "contentRating"    INTEGER NOT NULL,
    "trainerRating"    INTEGER NOT NULL,
    "usefulnessRating" INTEGER NOT NULL,
    "overallRating"    INTEGER NOT NULL,
    "comments"         TEXT,
    "submittedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingFeedback_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Training" ADD CONSTRAINT "Training_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Training" ADD CONSTRAINT "Training_targetSchoolId_fkey" FOREIGN KEY ("targetSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_trainingId_respondentId_key" UNIQUE ("trainingId", "respondentId");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "Training_targetSchoolId_idx" ON "Training"("targetSchoolId");
CREATE INDEX IF NOT EXISTS "TrainingFeedback_tenantId_trainingId_idx" ON "TrainingFeedback"("tenantId", "trainingId");
