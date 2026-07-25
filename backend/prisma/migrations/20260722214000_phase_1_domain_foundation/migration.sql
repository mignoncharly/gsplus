BEGIN;

-- Preserve immutable status history before replacing legacy enum values.
CREATE TABLE "ReservationTransition" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "adminUserId" TEXT,
    "oldStartAt" TIMESTAMP(3),
    "oldEndAt" TIMESTAMP(3),
    "newStartAt" TIMESTAMP(3),
    "newEndAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTransition" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "adminUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransition_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReservationTransition" (
    "id",
    "reservationId",
    "fromStatus",
    "toStatus",
    "actorType",
    "oldStartAt",
    "oldEndAt",
    "newStartAt",
    "newEndAt",
    "metadata",
    "createdAt"
)
SELECT
    'rt_phase1_' || substr(md5("id"), 1, 24),
    "id",
    NULL,
    CASE
        WHEN "status"::text IN ('PENDING', 'PAYMENT_PENDING') THEN 'PENDING_CONFIRMATION'
        ELSE "status"::text
    END,
    'MIGRATION',
    "startAt",
    "endAt",
    "startAt",
    "endAt",
    jsonb_build_object(
        'legacyStatus', "status"::text,
        'backfilledBy', '20260722214000_phase_1_domain_foundation'
    ),
    "updatedAt"
FROM "Reservation";

INSERT INTO "PaymentTransition" (
    "id",
    "paymentId",
    "fromStatus",
    "toStatus",
    "actorType",
    "metadata",
    "createdAt"
)
SELECT
    'pt_phase1_' || substr(md5("id"), 1, 24),
    "id",
    NULL,
    "status"::text,
    'MIGRATION',
    jsonb_build_object(
        'legacyStatus', "status"::text,
        'backfilledBy', '20260722214000_phase_1_domain_foundation'
    ),
    "updatedAt"
FROM "Payment";

-- Replace reservation enum so removed legacy values cannot be written again.
CREATE TYPE "ReservationStatus_phase1" AS ENUM (
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
    'REJECTED',
    'EXPIRED'
);

ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation"
ALTER COLUMN "status" TYPE "ReservationStatus_phase1"
USING (
    CASE
        WHEN "status"::text IN ('PENDING', 'PAYMENT_PENDING') THEN 'PENDING_CONFIRMATION'
        ELSE "status"::text
    END
)::"ReservationStatus_phase1";
DROP TYPE "ReservationStatus";
ALTER TYPE "ReservationStatus_phase1" RENAME TO "ReservationStatus";
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'PENDING_CONFIRMATION';

-- Replace payment enum with the independent verification/refund lifecycle.
CREATE TYPE "PaymentStatus_phase1" AS ENUM (
    'PENDING',
    'VERIFIED',
    'REJECTED',
    'FAILED',
    'EXPIRED',
    'REFUND_PENDING',
    'REFUNDED'
);

ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment"
ALTER COLUMN "status" TYPE "PaymentStatus_phase1"
USING ("status"::text::"PaymentStatus_phase1");
DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_phase1" RENAME TO "PaymentStatus";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Versioned and archive-safe tariff fields.
ALTER TABLE "Package"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'XAF',
ADD COLUMN "deliveryLabel" TEXT,
ADD COLUMN "options" JSONB,
ADD COLUMN "legalText" TEXT,
ADD COLUMN "legalApprovedAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "PackageVersion" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "durationMin" INTEGER NOT NULL,
    "deliveryLabel" TEXT,
    "options" JSONB,
    "legalText" TEXT,
    "legalApprovedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PackageVersion" (
    "id",
    "packageId",
    "version",
    "name",
    "category",
    "description",
    "price",
    "currency",
    "durationMin",
    "deliveryLabel",
    "options",
    "legalText",
    "legalApprovedAt",
    "createdAt"
)
SELECT
    'pv_phase1_' || substr(md5("id"), 1, 24),
    "id",
    1,
    "name",
    "category",
    "description",
    "price",
    "currency",
    "durationMin",
    "deliveryLabel",
    "options",
    "legalText",
    "legalApprovedAt",
    "createdAt"
FROM "Package";

-- Reservation lifecycle metadata and immutable tariff association.
ALTER TABLE "Reservation"
ADD COLUMN "packageVersionId" TEXT,
ADD COLUMN "statusReason" TEXT,
ADD COLUMN "statusChangedAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "Reservation" AS reservation
SET
    "packageVersionId" = version."id",
    "statusChangedAt" = reservation."updatedAt"
FROM "PackageVersion" AS version
WHERE
    version."packageId" = reservation."packageId"
    AND version."version" = 1;

ALTER TABLE "Reservation" ALTER COLUMN "packageVersionId" SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "statusChangedAt" SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Payment lifecycle, normalization, verification and refund metadata.
ALTER TABLE "Payment"
ADD COLUMN "transactionRefNormalized" TEXT,
ADD COLUMN "statusReason" TEXT,
ADD COLUMN "statusChangedAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "verifiedById" TEXT,
ADD COLUMN "refundAmount" INTEGER,
ADD COLUMN "refundedAt" TIMESTAMP(3);

UPDATE "Payment"
SET
    "transactionRefNormalized" = CASE
        WHEN "transactionRef" IS NULL THEN NULL
        ELSE upper(regexp_replace(trim("transactionRef"), '[[:space:]]+', '', 'g'))
    END,
    "statusChangedAt" = "updatedAt";

ALTER TABLE "Payment" ALTER COLUMN "statusChangedAt" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Payment"
        WHERE "transactionRefNormalized" IS NOT NULL
        GROUP BY "method", "transactionRefNormalized"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot enforce unique normalized payment references: duplicates exist';
    END IF;
END
$$;

-- Notification outbox/provider metadata. Existing events are preserved.
ALTER TABLE "NotificationEvent"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "providerMessageId" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "metadata" JSONB,
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "NotificationEvent"
SET
    "attemptCount" = CASE WHEN "sentAt" IS NULL THEN 0 ELSE 1 END,
    "deliveredAt" = "sentAt",
    "updatedAt" = "createdAt";

ALTER TABLE "NotificationEvent" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Indexes and uniqueness constraints.
CREATE INDEX "Package_isActive_isArchived_sortOrder_idx"
ON "Package"("isActive", "isArchived", "sortOrder");

CREATE UNIQUE INDEX "PackageVersion_packageId_version_key"
ON "PackageVersion"("packageId", "version");
CREATE INDEX "PackageVersion_packageId_createdAt_idx"
ON "PackageVersion"("packageId", "createdAt");
CREATE INDEX "PackageVersion_createdById_idx"
ON "PackageVersion"("createdById");

CREATE INDEX "Reservation_packageVersionId_idx"
ON "Reservation"("packageVersionId");
CREATE INDEX "Reservation_expiresAt_idx"
ON "Reservation"("expiresAt");

CREATE UNIQUE INDEX "Payment_method_transactionRefNormalized_key"
ON "Payment"("method", "transactionRefNormalized");
CREATE INDEX "Payment_verifiedById_idx"
ON "Payment"("verifiedById");

CREATE INDEX "ReservationTransition_reservationId_createdAt_idx"
ON "ReservationTransition"("reservationId", "createdAt");
CREATE INDEX "ReservationTransition_adminUserId_idx"
ON "ReservationTransition"("adminUserId");

CREATE INDEX "PaymentTransition_paymentId_createdAt_idx"
ON "PaymentTransition"("paymentId", "createdAt");
CREATE INDEX "PaymentTransition_adminUserId_idx"
ON "PaymentTransition"("adminUserId");

CREATE UNIQUE INDEX "NotificationEvent_idempotencyKey_key"
ON "NotificationEvent"("idempotencyKey");
CREATE UNIQUE INDEX "NotificationEvent_channel_providerMessageId_key"
ON "NotificationEvent"("channel", "providerMessageId");
CREATE INDEX "NotificationEvent_status_nextAttemptAt_idx"
ON "NotificationEvent"("status", "nextAttemptAt");

-- Referential integrity.
ALTER TABLE "PackageVersion"
ADD CONSTRAINT "PackageVersion_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageVersion"
ADD CONSTRAINT "PackageVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_packageVersionId_fkey"
FOREIGN KEY ("packageVersionId") REFERENCES "PackageVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationTransition"
ADD CONSTRAINT "ReservationTransition_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationTransition"
ADD CONSTRAINT "ReservationTransition_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_verifiedById_fkey"
FOREIGN KEY ("verifiedById") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentTransition"
ADD CONSTRAINT "PaymentTransition_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentTransition"
ADD CONSTRAINT "PaymentTransition_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
