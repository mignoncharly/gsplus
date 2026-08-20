-- Keep promotional WhatsApp consent separate from transactional booking messages.
-- Existing reservation snapshots did not grant promotional consent.
ALTER TABLE "ReservationSnapshot"
  ADD COLUMN "whatsappMarketingConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappMarketingConsentAt" TIMESTAMP(3);
