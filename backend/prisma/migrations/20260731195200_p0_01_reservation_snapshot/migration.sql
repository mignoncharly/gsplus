-- P0-01: immutable reservation identity, contact, tariff and consent evidence.
CREATE TABLE "ReservationSnapshot" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phoneRaw" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "email" TEXT,
  "notificationEmail" TEXT,
  "notificationPhoneE164" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "packageVersionId" TEXT NOT NULL,
  "packageVersion" INTEGER NOT NULL,
  "packageName" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "termsAccepted" BOOLEAN NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
  "privacyAccepted" BOOLEAN NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
  "whatsappConsent" BOOLEAN NOT NULL,
  "whatsappConsentAt" TIMESTAMP(3),
  "imageConsent" BOOLEAN NOT NULL,
  "imageAuthorizationVersion" TEXT NOT NULL,
  "imageConsentAt" TIMESTAMP(3),
  "source" TEXT NOT NULL,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationSnapshot_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReservationSnapshot" (
  "id", "reservationId", "firstName", "lastName", "phoneRaw", "phoneE164",
  "email", "notificationEmail", "notificationPhoneE164", "packageId",
  "packageVersionId", "packageVersion", "packageName", "startAt", "endAt",
  "durationMin", "amount", "currency", "termsAccepted", "termsVersion",
  "termsAcceptedAt", "privacyAccepted", "privacyVersion", "privacyAcceptedAt",
  "whatsappConsent", "whatsappConsentAt", "imageConsent",
  "imageAuthorizationVersion", "imageConsentAt", "source", "evidence", "createdAt"
)
SELECT
  'hist_' || md5(r."id" || clock_timestamp()::text),
  r."id",
  c."firstName",
  c."lastName",
  c."phone",
  c."phone",
  c."email",
  c."email",
  c."phone",
  r."packageId",
  r."packageVersionId",
  pv."version",
  pv."name",
  r."startAt",
  r."endAt",
  pv."durationMin",
  pv."price",
  pv."currency",
  r."acceptedTermsAt" IS NOT NULL,
  'HISTORICAL_UNKNOWN',
  COALESCE(r."acceptedTermsAt", r."createdAt"),
  r."acceptedTermsAt" IS NOT NULL,
  'HISTORICAL_UNKNOWN',
  COALESCE(r."acceptedTermsAt", r."createdAt"),
  r."whatsappConsentAt" IS NOT NULL,
  r."whatsappConsentAt",
  r."consentImage",
  'HISTORICAL_UNKNOWN',
  CASE WHEN r."consentImage" THEN r."createdAt" ELSE NULL END,
  'HISTORICAL_BACKFILL',
  jsonb_build_object('quality', 'UNVERIFIED_BACKFILL', 'backfilledAt', CURRENT_TIMESTAMP),
  r."createdAt"
FROM "Reservation" r
JOIN "Customer" c ON c."id" = r."customerId"
JOIN "PackageVersion" pv ON pv."id" = r."packageVersionId";

CREATE UNIQUE INDEX "ReservationSnapshot_reservationId_key"
  ON "ReservationSnapshot"("reservationId");
CREATE INDEX "ReservationSnapshot_phoneE164_idx"
  ON "ReservationSnapshot"("phoneE164");
CREATE INDEX "ReservationSnapshot_email_idx"
  ON "ReservationSnapshot"("email");
CREATE INDEX "ReservationSnapshot_packageId_packageVersion_idx"
  ON "ReservationSnapshot"("packageId", "packageVersion");
CREATE INDEX "ReservationSnapshot_createdAt_idx"
  ON "ReservationSnapshot"("createdAt");

ALTER TABLE "ReservationSnapshot"
  ADD CONSTRAINT "ReservationSnapshot_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "gsp_prevent_reservation_snapshot_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM "Reservation" WHERE "id" = OLD."reservationId"
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'RESERVATION_SNAPSHOT_IMMUTABLE';
END;
$$;

CREATE TRIGGER "ReservationSnapshot_immutable_update"
BEFORE UPDATE OR DELETE ON "ReservationSnapshot"
FOR EACH ROW
EXECUTE FUNCTION "gsp_prevent_reservation_snapshot_update"();

CREATE TABLE "DataIntegrityIncident" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "reservationId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "DataIntegrityIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DataIntegrityIncident_dedupeKey_key" ON "DataIntegrityIncident"("dedupeKey");
CREATE INDEX "DataIntegrityIncident_code_status_idx" ON "DataIntegrityIncident"("code", "status");
CREATE INDEX "DataIntegrityIncident_reservationId_idx" ON "DataIntegrityIncident"("reservationId");
CREATE INDEX "DataIntegrityIncident_lastSeenAt_idx" ON "DataIntegrityIncident"("lastSeenAt");
ALTER TABLE "DataIntegrityIncident"
  ADD CONSTRAINT "DataIntegrityIncident_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
