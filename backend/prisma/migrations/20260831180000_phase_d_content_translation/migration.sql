-- Phase D: retain publication state while recording English translation review.
ALTER TABLE "SiteContent"
  ADD COLUMN "translationStatus" TEXT,
  ADD COLUMN "translationSourceVersion" INTEGER,
  ADD COLUMN "translationError" TEXT;

CREATE INDEX "SiteContent_locale_translationStatus_idx"
  ON "SiteContent"("locale", "translationStatus");
