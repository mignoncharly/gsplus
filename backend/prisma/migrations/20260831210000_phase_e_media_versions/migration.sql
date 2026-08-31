-- Phase E: immutable history for portfolio file replacements.
CREATE TABLE "MediaVersion" (
  "id" TEXT NOT NULL,
  "mediaItemId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "storagePath" TEXT,
  "thumbnailUrl" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "thumbnailWidth" INTEGER,
  "thumbnailHeight" INTEGER,
  "thumbnailFileSize" INTEGER,
  "replacedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaVersion_mediaItemId_version_key" ON "MediaVersion"("mediaItemId", "version");
CREATE INDEX "MediaVersion_mediaItemId_createdAt_idx" ON "MediaVersion"("mediaItemId", "createdAt");
ALTER TABLE "MediaVersion" ADD CONSTRAINT "MediaVersion_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
