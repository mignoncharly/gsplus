ALTER TABLE "MediaItem"
ADD COLUMN "storagePath" TEXT,
ADD COLUMN "width" INTEGER,
ADD COLUMN "height" INTEGER,
ADD COLUMN "objectPosition" TEXT,
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "MediaItem_isPublished_sortOrder_idx" ON "MediaItem"("isPublished", "sortOrder");
CREATE INDEX "MediaItem_category_idx" ON "MediaItem"("category");
