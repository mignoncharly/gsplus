CREATE TABLE "ReservationRescheduleRequest" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "commandId" TEXT NOT NULL,
  "requestedById" TEXT,
  "decidedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reservationVersionAtRequest" INTEGER NOT NULL,
  "oldStartAt" TIMESTAMP(3) NOT NULL,
  "oldEndAt" TIMESTAMP(3) NOT NULL,
  "requestedStartAt" TIMESTAMP(3) NOT NULL,
  "requestedEndAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "decisionReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReservationRescheduleRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReservationRescheduleRequest_reservationId_createdAt_idx"
ON "ReservationRescheduleRequest"("reservationId", "createdAt");

CREATE UNIQUE INDEX "ReservationRescheduleRequest_commandId_key"
ON "ReservationRescheduleRequest"("commandId");

CREATE INDEX "ReservationRescheduleRequest_status_requestedAt_idx"
ON "ReservationRescheduleRequest"("status", "requestedAt");

CREATE INDEX "ReservationRescheduleRequest_requestedById_idx"
ON "ReservationRescheduleRequest"("requestedById");

CREATE INDEX "ReservationRescheduleRequest_decidedById_idx"
ON "ReservationRescheduleRequest"("decidedById");

CREATE UNIQUE INDEX "ReservationRescheduleRequest_one_pending_per_reservation"
ON "ReservationRescheduleRequest"("reservationId")
WHERE "status" = 'PENDING';

ALTER TABLE "ReservationRescheduleRequest"
ADD CONSTRAINT "ReservationRescheduleRequest_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationRescheduleRequest"
ADD CONSTRAINT "ReservationRescheduleRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationRescheduleRequest"
ADD CONSTRAINT "ReservationRescheduleRequest_decidedById_fkey"
FOREIGN KEY ("decidedById") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
