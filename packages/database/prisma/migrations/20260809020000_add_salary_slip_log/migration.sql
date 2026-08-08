-- Audit trail for salary slip generation: one row per PDF actually printed,
-- so HR can see who generated whose slip and when, in a dedicated log
-- separate from the generic AuditLog table. Safe to re-run.

CREATE TABLE IF NOT EXISTS "SalarySlipLog" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "employeeId"    TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "period"        TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalarySlipLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "SalarySlipLog" ADD CONSTRAINT "SalarySlipLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalarySlipLog" ADD CONSTRAINT "SalarySlipLog_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "SalarySlipLog_tenantId_createdAt_idx" ON "SalarySlipLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "SalarySlipLog_employeeId_idx" ON "SalarySlipLog"("employeeId");
