-- P0-04: distinct payment states and durable idempotent admin commands.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_INFO_REQUIRED' BEFORE 'VERIFIED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'VERIFICATION_BLOCKED' BEFORE 'VERIFIED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAID' AFTER 'VERIFIED';

CREATE TABLE "AdminCommand" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "result" JSONB,
  "adminUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AdminCommand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminCommand_entityType_entityId_createdAt_idx"
  ON "AdminCommand"("entityType", "entityId", "createdAt");
CREATE INDEX "AdminCommand_adminUserId_createdAt_idx"
  ON "AdminCommand"("adminUserId", "createdAt");
CREATE INDEX "AdminCommand_status_createdAt_idx"
  ON "AdminCommand"("status", "createdAt");

ALTER TABLE "AdminCommand"
  ADD CONSTRAINT "AdminCommand_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
