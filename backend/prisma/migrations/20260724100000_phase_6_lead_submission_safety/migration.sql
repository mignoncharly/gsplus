-- Phase 6: make public lead creation idempotent across rapid repeats and retries.
ALTER TABLE "Lead" ADD COLUMN "submissionKey" TEXT;

CREATE UNIQUE INDEX "Lead_submissionKey_key" ON "Lead"("submissionKey");
