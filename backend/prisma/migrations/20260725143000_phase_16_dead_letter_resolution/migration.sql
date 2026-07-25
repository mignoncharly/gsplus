ALTER TABLE "NotificationEvent"
ADD COLUMN "resolution" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolvedBy" TEXT,
ADD COLUMN "replacementEventId" TEXT;

UPDATE "NotificationEvent"
SET "error" = 'LEGACY_SMTP_AUTHENTICATION_FAILED'
WHERE "status" = 'FAILED'
  AND "channel" = 'email'
  AND "error" LIKE '%Authentication Failed%';

CREATE INDEX "NotificationEvent_status_resolvedAt_idx"
  ON "NotificationEvent"("status", "resolvedAt");

-- Preserve every legacy calendar row while replacing unsafe/unhelpful free-text errors
-- with stable operational codes understood by the current admin interface.
UPDATE "CalendarSyncLog"
SET "error" = CASE
  WHEN "error" = '[object Object]' THEN 'CALENDAR_LEGACY_PROVIDER_FAILURE'
  WHEN "error" = 'Reservation status PAYMENT_PENDING does not sync to Cal.com' THEN 'CALENDAR_STATUS_NOT_SYNCABLE'
  WHEN "error" = 'No Cal.com booking was found for this reservation' THEN 'CALENDAR_EXTERNAL_EVENT_NOT_FOUND'
  ELSE "error"
END
WHERE "error" IN (
  '[object Object]',
  'Reservation status PAYMENT_PENDING does not sync to Cal.com',
  'No Cal.com booking was found for this reservation'
);
