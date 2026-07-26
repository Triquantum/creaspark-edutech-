-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "student_register_seq" START 1;

-- AlterTable: add nullable first so existing rows can be backfilled
ALTER TABLE "Student" ADD COLUMN "registerNo" TEXT;

-- Backfill existing students with a generated register number
UPDATE "Student"
SET "registerNo" = 'REG-' || lpad(nextval('student_register_seq')::text, 6, '0')
WHERE "registerNo" IS NULL;

-- Enforce NOT NULL + default for all future inserts
ALTER TABLE "Student" ALTER COLUMN "registerNo" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "registerNo" SET DEFAULT ('REG-' || lpad(nextval('student_register_seq')::text, 6, '0'));

-- CreateIndex
CREATE UNIQUE INDEX "Student_registerNo_key" ON "Student"("registerNo");
