CREATE TABLE "NotificationAttempt" (
  "id" TEXT NOT NULL,
  "notificationEventId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "providerStatus" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationAttempt_notificationEventId_attemptNumber_key"
ON "NotificationAttempt"("notificationEventId", "attemptNumber");

CREATE INDEX "NotificationAttempt_providerMessageId_idx"
ON "NotificationAttempt"("providerMessageId");

CREATE INDEX "NotificationAttempt_status_startedAt_idx"
ON "NotificationAttempt"("status", "startedAt");

ALTER TABLE "NotificationAttempt"
ADD CONSTRAINT "NotificationAttempt_notificationEventId_fkey"
FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
