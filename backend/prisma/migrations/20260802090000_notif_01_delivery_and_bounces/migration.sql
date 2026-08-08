CREATE TABLE "ReservationDelivery" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "publishedById" TEXT,
    "reservationVersionAtPublish" INTEGER NOT NULL,
    "deliveryUrl" TEXT NOT NULL,
    "accessInstruction" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "verificationStatusCode" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReservationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDeliveryReport" (
    "id" TEXT NOT NULL,
    "notificationEventId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "smtpCode" TEXT,
    "safeMessage" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDeliveryReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationDelivery_commandId_key" ON "ReservationDelivery"("commandId");
CREATE INDEX "ReservationDelivery_reservationId_createdAt_idx" ON "ReservationDelivery"("reservationId", "createdAt");
CREATE INDEX "ReservationDelivery_status_expiresAt_idx" ON "ReservationDelivery"("status", "expiresAt");
CREATE INDEX "ReservationDelivery_publishedById_idx" ON "ReservationDelivery"("publishedById");
CREATE UNIQUE INDEX "EmailDeliveryReport_providerEventId_key" ON "EmailDeliveryReport"("providerEventId");
CREATE INDEX "EmailDeliveryReport_notificationEventId_occurredAt_idx" ON "EmailDeliveryReport"("notificationEventId", "occurredAt");
CREATE INDEX "EmailDeliveryReport_status_occurredAt_idx" ON "EmailDeliveryReport"("status", "occurredAt");

ALTER TABLE "ReservationDelivery" ADD CONSTRAINT "ReservationDelivery_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationDelivery" ADD CONSTRAINT "ReservationDelivery_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailDeliveryReport" ADD CONSTRAINT "EmailDeliveryReport_notificationEventId_fkey" FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
