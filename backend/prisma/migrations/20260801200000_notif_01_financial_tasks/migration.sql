CREATE TABLE "FinancialTask" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "createdById" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XAF',
  "reason" TEXT NOT NULL,
  "channel" TEXT,
  "providerReference" TEXT,
  "proof" JSONB,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "initiatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinancialTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialTask_dedupeKey_key"
ON "FinancialTask"("dedupeKey");

CREATE INDEX "FinancialTask_status_dueAt_idx"
ON "FinancialTask"("status", "dueAt");

CREATE INDEX "FinancialTask_reservationId_createdAt_idx"
ON "FinancialTask"("reservationId", "createdAt");

CREATE INDEX "FinancialTask_paymentId_idx"
ON "FinancialTask"("paymentId");

CREATE INDEX "FinancialTask_createdById_idx"
ON "FinancialTask"("createdById");

ALTER TABLE "FinancialTask"
ADD CONSTRAINT "FinancialTask_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialTask"
ADD CONSTRAINT "FinancialTask_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialTask"
ADD CONSTRAINT "FinancialTask_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
