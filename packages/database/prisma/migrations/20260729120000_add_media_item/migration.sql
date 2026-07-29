-- Photo/video gallery: uploaded by Super/Org/School Admin or Teacher,
-- viewable by the wider school community (+ Parent, Student).

DO $$ BEGIN
  CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "MediaItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "MediaType" NOT NULL,
  "url" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "MediaItem_tenantId_schoolId_createdAt_idx" ON "MediaItem"("tenantId", "schoolId", "createdAt");
