ALTER TABLE "NotificationEvent"
ADD COLUMN "templateCode" TEXT,
ADD COLUMN "templateVersion" TEXT,
ADD COLUMN "renderedContent" JSONB,
ADD COLUMN "readAt" TIMESTAMP(3);
