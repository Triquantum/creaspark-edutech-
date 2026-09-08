-- Public-website media (gallery, hero video, story photo), managed by
-- Super Admin only and served unauthenticated to the marketing site.
-- Not tenant/school scoped -- this is global site content. Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "HomepageMediaSection" AS ENUM ('GALLERY', 'HERO_VIDEO', 'STORY_PHOTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "HomepageMedia" (
    "id"         TEXT NOT NULL,
    "section"    "HomepageMediaSection" NOT NULL,
    "type"       "MediaType" NOT NULL,
    "title"      TEXT,
    "url"        TEXT NOT NULL,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomepageMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HomepageMedia_section_sortOrder_idx" ON "HomepageMedia"("section", "sortOrder");
