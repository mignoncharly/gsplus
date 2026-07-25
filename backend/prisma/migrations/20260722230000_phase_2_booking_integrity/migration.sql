-- Phase 2: server-issued booking references and short-lived slot intents.
CREATE TABLE "ReservationIntent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationIntent_idempotencyKey_key"
    ON "ReservationIntent"("idempotencyKey");
CREATE UNIQUE INDEX "ReservationIntent_reference_key"
    ON "ReservationIntent"("reference");
CREATE UNIQUE INDEX "ReservationIntent_reservationId_key"
    ON "ReservationIntent"("reservationId");
CREATE INDEX "ReservationIntent_startAt_endAt_expiresAt_idx"
    ON "ReservationIntent"("startAt", "endAt", "expiresAt");
CREATE INDEX "ReservationIntent_packageId_idx"
    ON "ReservationIntent"("packageId");

ALTER TABLE "ReservationIntent" ADD CONSTRAINT "ReservationIntent_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationIntent" ADD CONSTRAINT "ReservationIntent_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
