-- CreateEnum
CREATE TYPE "PortionMode" AS ENUM ('PRACTICAL', 'THEORY');

-- CreateEnum
CREATE TYPE "PortionCompletionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "PortionReport" ADD COLUMN "chapterName" TEXT;
ALTER TABLE "PortionReport" ADD COLUMN "description" TEXT;
ALTER TABLE "PortionReport" ADD COLUMN "mode" "PortionMode";
ALTER TABLE "PortionReport" ADD COLUMN "completionStatus" "PortionCompletionStatus";
