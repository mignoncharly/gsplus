ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "Reservation"
  ADD COLUMN "whatsappConsentAt" TIMESTAMP(3);

ALTER TABLE "Lead"
  ADD COLUMN "whatsappConsentAt" TIMESTAMP(3);

ALTER TABLE "NotificationEvent"
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

CREATE INDEX "NotificationEvent_status_lockedAt_idx"
  ON "NotificationEvent"("status", "lockedAt");
