-- StaffProfile.salary: optional monthly gross salary (INR), source for the
-- Salary Certificate and Salary Slip generators. Nullable -- existing rows
-- are unaffected until an admin sets it. Safe to re-run.

ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "salary" DECIMAL(10, 2);
