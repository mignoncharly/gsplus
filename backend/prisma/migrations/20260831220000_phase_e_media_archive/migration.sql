ALTER TABLE "MediaItem" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MediaItem" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "MediaItem_isPublished_isArchived_sortOrder_idx" ON "MediaItem"("isPublished", "isArchived", "sortOrder");
