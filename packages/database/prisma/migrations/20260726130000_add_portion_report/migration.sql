-- CreateEnum
CREATE TYPE "PortionPeriod" AS ENUM ('DAILY', 'WEEKLY');
CREATE TYPE "PortionStatus" AS ENUM ('SUBMITTED', 'REVIEWED', 'FLAGGED');

-- CreateTable
CREATE TABLE "PortionReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT,
    "sectionId" TEXT,
    "period" "PortionPeriod" NOT NULL DEFAULT 'DAILY',
    "periodDate" DATE NOT NULL,
    "topicsCovered" TEXT NOT NULL,
    "percentComplete" INTEGER,
    "status" "PortionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortionReport_tenantId_schoolId_periodDate_idx" ON "PortionReport"("tenantId", "schoolId", "periodDate");

-- CreateIndex
CREATE INDEX "PortionReport_tenantId_teacherId_periodDate_idx" ON "PortionReport"("tenantId", "teacherId", "periodDate");

-- AddForeignKey
ALTER TABLE "PortionReport" ADD CONSTRAINT "PortionReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortionReport" ADD CONSTRAINT "PortionReport_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortionReport" ADD CONSTRAINT "PortionReport_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortionReport" ADD CONSTRAINT "PortionReport_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortionReport" ADD CONSTRAINT "PortionReport_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortionReport" ADD CONSTRAINT "PortionReport_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
