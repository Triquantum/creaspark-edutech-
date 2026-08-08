-- Last working date, shown on the Employee edit form once Status is set
-- away from Active. Nullable -- most employees never have one, and it's
-- cleared back to NULL if the employee is reactivated.

ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "lastWorkingDate" TIMESTAMP(3);
