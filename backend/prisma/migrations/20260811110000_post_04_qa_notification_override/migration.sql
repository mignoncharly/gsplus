CREATE TABLE "ReservationNotificationOverride" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientFingerprint" TEXT NOT NULL,
  "previousRecipientFingerprint" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "commandId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deactivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "ReservationNotificationOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationNotificationOverride_version_check" CHECK ("version" > 0),
  CONSTRAINT "ReservationNotificationOverride_reason_check" CHECK (length(trim("reason")) >= 10),
  CONSTRAINT "ReservationNotificationOverride_state_check" CHECK (
    ("isActive" = true AND "deactivatedAt" IS NULL) OR
    ("isActive" = false AND "deactivatedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "ReservationNotificationOverride_commandId_key"
ON "ReservationNotificationOverride"("commandId");
CREATE UNIQUE INDEX "ReservationNotificationOverride_reservationId_version_key"
ON "ReservationNotificationOverride"("reservationId", "version");
CREATE UNIQUE INDEX "ReservationNotificationOverride_one_active_per_reservation_key"
ON "ReservationNotificationOverride"("reservationId") WHERE "isActive" = true;
CREATE INDEX "ReservationNotificationOverride_reservationId_isActive_createdAt_idx"
ON "ReservationNotificationOverride"("reservationId", "isActive", "createdAt");
CREATE INDEX "ReservationNotificationOverride_createdById_createdAt_idx"
ON "ReservationNotificationOverride"("createdById", "createdAt");

ALTER TABLE "ReservationNotificationOverride"
ADD CONSTRAINT "ReservationNotificationOverride_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationNotificationOverride"
ADD CONSTRAINT "ReservationNotificationOverride_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
