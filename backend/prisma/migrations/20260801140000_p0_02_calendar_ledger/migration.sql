ALTER TABLE "CalendarSyncLog"
  ADD COLUMN "payloadHash" TEXT,
  ADD COLUMN "reservationVersion" INTEGER,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "syncedAt" TIMESTAMP(3);

ALTER TABLE "CalendarSyncLog" ALTER COLUMN "action" SET DEFAULT 'CREATE';
ALTER TABLE "CalendarSyncLog" ALTER COLUMN "maxAttempts" SET DEFAULT 3;

UPDATE "CalendarSyncLog"
SET "status" = CASE
  WHEN "status" = 'PROCESSING' THEN 'SYNCING'
  WHEN "status" IN ('UPDATED', 'DELETED') THEN 'SYNCED'
  WHEN "status" = 'SKIPPED' THEN 'NOT_REQUIRED'
  ELSE "status"
END;

DROP INDEX IF EXISTS "CalendarSyncLog_status_lockedAt_idx";
CREATE INDEX "CalendarSyncLog_status_nextAttemptAt_lockedAt_idx"
  ON "CalendarSyncLog"("status", "nextAttemptAt", "lockedAt");
