-- CreateTable
CREATE TABLE "CourseView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseView_courseId_studentId_key" ON "CourseView"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "CourseView_tenantId_studentId_idx" ON "CourseView"("tenantId", "studentId");

-- AddForeignKey
ALTER TABLE "CourseView" ADD CONSTRAINT "CourseView_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseView" ADD CONSTRAINT "CourseView_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
