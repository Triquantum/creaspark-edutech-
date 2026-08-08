-- Dedicated Holiday model (start/end date, subject, description, remarks,
-- multiple images) replacing the generic catch-all scaffold previously used
-- at /announcement/holiday. Safe to re-run.

CREATE TABLE IF NOT EXISTS "Holiday" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "subject"     TEXT NOT NULL,
    "description" TEXT,
    "remarks"     TEXT,
    "startDate"   DATE NOT NULL,
    "endDate"     DATE NOT NULL,
    "images"      TEXT[] NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "Holiday_tenantId_startDate_idx" ON "Holiday"("tenantId", "startDate");

-- Public bucket for holiday images (browser uploads directly, same
-- convention as School.logoUrl / school-logos) -- non-sensitive announcement
-- content, so public read is fine; only authenticated sessions may upload.
INSERT INTO storage.buckets (id, name, public)
VALUES ('holiday-images', 'holiday-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public read holiday images" ON storage.objects FOR SELECT USING (bucket_id = 'holiday-images');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated upload holiday images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'holiday-images');
EXCEPTION WHEN duplicate_object THEN null; END $$;
