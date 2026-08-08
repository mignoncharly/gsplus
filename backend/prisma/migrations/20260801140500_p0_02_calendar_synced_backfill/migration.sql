UPDATE "CalendarSyncLog"
SET "syncedAt" = "updatedAt"
WHERE "status" = 'SYNCED' AND "syncedAt" IS NULL;
