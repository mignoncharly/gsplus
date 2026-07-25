ALTER TABLE "CalendarSyncLog"
  ALTER COLUMN "provider" SET DEFAULT 'cal_com',
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ADD COLUMN "action" TEXT NOT NULL DEFAULT 'UPSERT',
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CalendarSyncLog"
SET
  "status" = UPPER("status"),
  "action" = CASE WHEN LOWER("status") = 'deleted' THEN 'DELETE' ELSE 'UPSERT' END;

CREATE UNIQUE INDEX "CalendarSyncLog_idempotencyKey_key"
  ON "CalendarSyncLog"("idempotencyKey");

DROP INDEX IF EXISTS "CalendarSyncLog_reservationId_idx";
CREATE INDEX "CalendarSyncLog_reservationId_createdAt_idx"
  ON "CalendarSyncLog"("reservationId", "createdAt");
CREATE INDEX "CalendarSyncLog_status_lockedAt_idx"
  ON "CalendarSyncLog"("status", "lockedAt");
