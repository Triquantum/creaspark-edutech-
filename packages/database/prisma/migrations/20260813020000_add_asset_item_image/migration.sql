-- Lets an inventory item carry a photo so it's easier to identify at a
-- glance. Safe to re-run.

ALTER TABLE "AssetItem" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
