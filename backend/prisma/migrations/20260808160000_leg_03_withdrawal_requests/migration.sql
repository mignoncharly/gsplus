CREATE TABLE "ReservationWithdrawalRequest" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "commandId" TEXT NOT NULL,
  "requestedById" TEXT,
  "decidedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reservationVersionAtRequest" INTEGER NOT NULL,
  "contractConcludedAt" TIMESTAMP(3) NOT NULL,
  "legalDeadlineAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "receivedWithinLegalWindow" BOOLEAN NOT NULL,
  "requestChannel" TEXT NOT NULL,
  "requestText" TEXT NOT NULL,
  "requestEvidence" TEXT NOT NULL,
  "serviceStatus" TEXT NOT NULL,
  "executionStartedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReservationWithdrawalRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationWithdrawalRequest_service_status_check"
    CHECK ("serviceStatus" IN ('NOT_STARTED', 'STARTED', 'COMPLETED')),
  CONSTRAINT "ReservationWithdrawalRequest_status_check"
    CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  CONSTRAINT "ReservationWithdrawalRequest_execution_start_check"
    CHECK (
      ("serviceStatus" = 'NOT_STARTED' AND "executionStartedAt" IS NULL)
      OR ("serviceStatus" IN ('STARTED', 'COMPLETED') AND "executionStartedAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "ReservationWithdrawalRequest_commandId_key"
ON "ReservationWithdrawalRequest"("commandId");

CREATE INDEX "ReservationWithdrawalRequest_reservationId_createdAt_idx"
ON "ReservationWithdrawalRequest"("reservationId", "createdAt");

CREATE INDEX "ReservationWithdrawalRequest_status_receivedAt_idx"
ON "ReservationWithdrawalRequest"("status", "receivedAt");

CREATE INDEX "ReservationWithdrawalRequest_requestedById_idx"
ON "ReservationWithdrawalRequest"("requestedById");

CREATE INDEX "ReservationWithdrawalRequest_decidedById_idx"
ON "ReservationWithdrawalRequest"("decidedById");

CREATE UNIQUE INDEX "ReservationWithdrawalRequest_one_pending_per_reservation"
ON "ReservationWithdrawalRequest"("reservationId")
WHERE "status" = 'PENDING';

ALTER TABLE "ReservationWithdrawalRequest"
ADD CONSTRAINT "ReservationWithdrawalRequest_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationWithdrawalRequest"
ADD CONSTRAINT "ReservationWithdrawalRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationWithdrawalRequest"
ADD CONSTRAINT "ReservationWithdrawalRequest_decidedById_fkey"
FOREIGN KEY ("decidedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
