-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'COLLEGE', 'INSTITUTE');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "institutionType" "InstitutionType" NOT NULL DEFAULT 'SCHOOL';
