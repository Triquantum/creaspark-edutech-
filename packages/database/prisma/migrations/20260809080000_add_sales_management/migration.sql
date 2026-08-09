-- Sales Management & Daily Activity Tracking: adds the Lead -> Activity ->
-- Follow-up -> Opportunity chain, plus daily reports and targets. Reuses
-- the existing User/School/TaskItem/AuditLog models rather than duplicating
-- them. Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES_EXECUTIVE';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES_MANAGER';

DO $$ BEGIN
  CREATE TYPE "SalesActivityType" AS ENUM ('CALL', 'SCHOOL_VISIT', 'CUSTOMER_VISIT', 'MEETING', 'ONLINE_MEETING', 'PRODUCT_DEMO', 'EMAIL', 'MESSAGE', 'FOLLOW_UP', 'LEAD_CREATION', 'PROPOSAL', 'QUOTATION', 'NEGOTIATION', 'DELIVERY', 'TRAINING_DEMO', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesLeadSource" AS ENUM ('WEBSITE', 'REFERRAL', 'DIRECT_CONTACT', 'EVENT', 'SCHOOL_VISIT', 'EXISTING_CUSTOMER', 'CAMPAIGN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'LOST');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesOpportunityStage" AS ENUM ('LEAD', 'CONTACTED', 'INTERESTED', 'MEETING', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesFollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesTargetPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesTargetMetric" AS ENUM ('CALLS', 'VISITS', 'MEETINGS', 'LEADS', 'DEMOS', 'PROPOSALS', 'CONVERSIONS', 'REVENUE');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "SalesPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "SalesLead" (
    "id"                TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL,
    "schoolName"        TEXT NOT NULL,
    "contactPerson"     TEXT,
    "phone"             TEXT,
    "email"             TEXT,
    "location"          TEXT,
    "source"            "SalesLeadSource" NOT NULL DEFAULT 'OTHER',
    "status"            "SalesLeadStatus" NOT NULL DEFAULT 'NEW',
    "priority"          "SalesPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes"             TEXT,
    "assignedToId"      TEXT NOT NULL,
    "convertedSchoolId" TEXT,
    "leadDate"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesLead_tenantId_assignedToId_status_idx" ON "SalesLead"("tenantId", "assignedToId", "status");
DO $$ BEGIN
  ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_convertedSchoolId_fkey" FOREIGN KEY ("convertedSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "SalesOpportunity" (
    "id"                  TEXT NOT NULL,
    "tenantId"            TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "schoolId"            TEXT,
    "leadId"              TEXT,
    "value"               DECIMAL(12,2),
    "stage"               "SalesOpportunityStage" NOT NULL DEFAULT 'LEAD',
    "probability"         INTEGER NOT NULL DEFAULT 10,
    "expectedClosingDate" TIMESTAMP(3),
    "nextAction"          TEXT,
    "nextFollowUpDate"    TIMESTAMP(3),
    "assignedToId"        TEXT NOT NULL,
    "wonAt"               TIMESTAMP(3),
    "lostAt"              TIMESTAMP(3),
    "lostReason"          TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesOpportunity_tenantId_assignedToId_stage_idx" ON "SalesOpportunity"("tenantId", "assignedToId", "stage");
DO $$ BEGIN
  ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "SalesActivity" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "type"             "SalesActivityType" NOT NULL,
    "schoolId"         TEXT,
    "leadId"           TEXT,
    "opportunityId"    TEXT,
    "contactPerson"    TEXT,
    "purpose"          TEXT,
    "description"      TEXT,
    "outcome"          TEXT,
    "activityDate"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime"        TIMESTAMP(3),
    "endTime"          TIMESTAMP(3),
    "checkInAt"        TIMESTAMP(3),
    "checkInLat"       DOUBLE PRECISION,
    "checkInLng"       DOUBLE PRECISION,
    "checkOutAt"       TIMESTAMP(3),
    "checkOutLat"      DOUBLE PRECISION,
    "checkOutLng"      DOUBLE PRECISION,
    "nextAction"       TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "priority"         "SalesPriority" NOT NULL DEFAULT 'MEDIUM',
    "status"           "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "generatedTaskId"  TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesActivity_generatedTaskId_key" ON "SalesActivity"("generatedTaskId");
CREATE INDEX IF NOT EXISTS "SalesActivity_tenantId_userId_activityDate_idx" ON "SalesActivity"("tenantId", "userId", "activityDate");
CREATE INDEX IF NOT EXISTS "SalesActivity_tenantId_schoolId_idx" ON "SalesActivity"("tenantId", "schoolId");
DO $$ BEGIN
  ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_generatedTaskId_fkey" FOREIGN KEY ("generatedTaskId") REFERENCES "TaskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "SalesFollowUp" (
    "id"                  TEXT NOT NULL,
    "tenantId"            TEXT NOT NULL,
    "userId"              TEXT NOT NULL,
    "schoolId"            TEXT,
    "leadId"              TEXT,
    "opportunityId"       TEXT,
    "sourceActivityId"    TEXT,
    "nextAction"          TEXT NOT NULL,
    "dueDate"             TIMESTAMP(3) NOT NULL,
    "priority"            "SalesPriority" NOT NULL DEFAULT 'MEDIUM',
    "status"              "SalesFollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt"         TIMESTAMP(3),
    "completedActivityId" TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesFollowUp_sourceActivityId_key" ON "SalesFollowUp"("sourceActivityId");
CREATE INDEX IF NOT EXISTS "SalesFollowUp_tenantId_userId_status_dueDate_idx" ON "SalesFollowUp"("tenantId", "userId", "status", "dueDate");
DO $$ BEGIN
  ALTER TABLE "SalesFollowUp" ADD CONSTRAINT "SalesFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesFollowUp" ADD CONSTRAINT "SalesFollowUp_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesFollowUp" ADD CONSTRAINT "SalesFollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesFollowUp" ADD CONSTRAINT "SalesFollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesFollowUp" ADD CONSTRAINT "SalesFollowUp_sourceActivityId_fkey" FOREIGN KEY ("sourceActivityId") REFERENCES "SalesActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "SalesDailyReport" (
    "id"                 TEXT NOT NULL,
    "tenantId"           TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "reportDate"         DATE NOT NULL,
    "status"             "SalesReportStatus" NOT NULL DEFAULT 'DRAFT',
    "achievements"       TEXT,
    "majorOpportunities" TEXT,
    "challenges"         TEXT,
    "supportRequired"    TEXT,
    "tomorrowPriorities" TEXT,
    "tomorrowPlan"       TEXT,
    "managerComments"    TEXT,
    "reviewedById"       TEXT,
    "submittedAt"        TIMESTAMP(3),
    "reviewedAt"         TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesDailyReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesDailyReport_userId_reportDate_key" ON "SalesDailyReport"("userId", "reportDate");
CREATE INDEX IF NOT EXISTS "SalesDailyReport_tenantId_reportDate_idx" ON "SalesDailyReport"("tenantId", "reportDate");
DO $$ BEGIN
  ALTER TABLE "SalesDailyReport" ADD CONSTRAINT "SalesDailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesDailyReport" ADD CONSTRAINT "SalesDailyReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "SalesTarget" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "userId"      TEXT,
    "period"      "SalesTargetPeriod" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd"   DATE NOT NULL,
    "metric"      "SalesTargetMetric" NOT NULL,
    "targetValue" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesTarget_userId_period_periodStart_metric_key" ON "SalesTarget"("userId", "period", "periodStart", "metric");
CREATE INDEX IF NOT EXISTS "SalesTarget_tenantId_period_periodStart_idx" ON "SalesTarget"("tenantId", "period", "periodStart");
DO $$ BEGIN
  ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
