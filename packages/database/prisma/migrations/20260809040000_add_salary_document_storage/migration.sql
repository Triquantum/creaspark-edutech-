-- Persists generated salary slips/certificates as real PDF files (in the
-- private "salary-documents" Supabase Storage bucket) instead of only
-- logging metadata, so a past document can be re-previewed/downloaded via
-- a server-issued signed URL. Safe to re-run.

ALTER TABLE "SalarySlipLog" ADD COLUMN IF NOT EXISTS "storagePath" TEXT;

CREATE TABLE IF NOT EXISTS "SalaryCertificateLog" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "employeeId"    TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "refNo"         TEXT,
    "storagePath"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryCertificateLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "SalaryCertificateLog" ADD CONSTRAINT "SalaryCertificateLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalaryCertificateLog" ADD CONSTRAINT "SalaryCertificateLog_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "SalaryCertificateLog_tenantId_createdAt_idx" ON "SalaryCertificateLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "SalaryCertificateLog_employeeId_idx" ON "SalaryCertificateLog"("employeeId");

-- Private bucket: no RLS SELECT/INSERT policies are added on purpose -- only
-- the API's Supabase service-role key touches this bucket (uploads and
-- signed-URL generation both bypass RLS as the service role), so it stays
-- inaccessible to any client-side/anon/authenticated Supabase session.
INSERT INTO storage.buckets (id, name, public)
VALUES ('salary-documents', 'salary-documents', false)
ON CONFLICT (id) DO NOTHING;
