ALTER TABLE "MediaItem"
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "fileSize" INTEGER,
ADD COLUMN "thumbnailWidth" INTEGER,
ADD COLUMN "thumbnailHeight" INTEGER,
ADD COLUMN "thumbnailFileSize" INTEGER;

UPDATE "MediaItem"
SET "isPublished" = false
WHERE lower(coalesce("category", '')) IN ('hero', 'qa_test', 'qa-test')
   OR lower("title") LIKE 'test qa%';
