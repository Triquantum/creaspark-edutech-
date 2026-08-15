-- Two new admin-tier roles: Academic Admin (full admin breadth minus
-- Users/HR) and Finance Admin & HR (HR/Payroll/Fees, view-only elsewhere).
-- Additive only. Safe to re-run.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACADEMIC_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCE_HR_ADMIN';
