-- LEG-04: published legal versions and append-only image consent evidence.
CREATE TABLE "LegalDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "sourceDocumentHash" TEXT NOT NULL,
  "noticeText" TEXT NOT NULL,
  "purpose" TEXT,
  "scope" JSONB,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalDocumentVersion_status_check" CHECK ("status" IN ('PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "LegalDocumentVersion_dates_check" CHECK ("publishedAt" >= "effectiveAt")
);

CREATE UNIQUE INDEX "LegalDocumentVersion_documentType_version_key"
ON "LegalDocumentVersion"("documentType", "version");
CREATE INDEX "LegalDocumentVersion_documentType_status_effectiveAt_idx"
ON "LegalDocumentVersion"("documentType", "status", "effectiveAt");

INSERT INTO "LegalDocumentVersion" (
  "id", "documentType", "version", "sourceDocumentHash", "noticeText",
  "purpose", "scope", "effectiveAt", "publishedAt"
) VALUES
  (
    'legal-terms-2026-07-31', 'TERMS', '2026-07-31',
    '1deae47a85c0beaf580527f32ff638617c612e5e00d12743dd201e9e18116418',
    'Conditions générales de vente consolidées du 31 juillet 2026.',
    'CONTRACT', '["RESERVATION","PAYMENT","SERVICE"]'::jsonb,
    '2026-07-31T00:00:00.000Z', '2026-07-31T00:00:00.000Z'
  ),
  (
    'legal-privacy-2026-07-31', 'PRIVACY', '2026-07-31',
    '1deae47a85c0beaf580527f32ff638617c612e5e00d12743dd201e9e18116418',
    'Politique de confidentialité consolidée du 31 juillet 2026.',
    'PRIVACY_INFORMATION', '["RESERVATION","PAYMENT","COMMUNICATION","IMAGES"]'::jsonb,
    '2026-07-31T00:00:00.000Z', '2026-07-31T00:00:00.000Z'
  ),
  (
    'legal-image-2026-07-31', 'IMAGE_AUTHORIZATION', '2026-07-31',
    '1deae47a85c0beaf580527f32ff638617c612e5e00d12743dd201e9e18116418',
    'J’autorise Golden Studio Plus à utiliser certaines images de la séance pour le portfolio et la promotion du Studio sur son site web, Instagram et TikTok. Le retrait produit effet pour l’avenir.',
    'PORTFOLIO_AND_PROMOTION', '["WEBSITE","INSTAGRAM","TIKTOK"]'::jsonb,
    '2026-07-31T00:00:00.000Z', '2026-07-31T00:00:00.000Z'
  );

CREATE TABLE "ImageConsentEvent" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "legalVersionId" TEXT NOT NULL,
  "commandId" TEXT,
  "choice" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "source" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "priorEventId" TEXT,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageConsentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImageConsentEvent_choice_check" CHECK ("choice" IN ('GRANTED', 'REFUSED', 'WITHDRAWN')),
  CONSTRAINT "ImageConsentEvent_purpose_check" CHECK (length(trim("purpose")) > 0),
  CONSTRAINT "ImageConsentEvent_scope_check" CHECK (jsonb_typeof("scope") = 'array' AND jsonb_array_length("scope") > 0),
  CONSTRAINT "ImageConsentEvent_evidence_check" CHECK (jsonb_typeof("evidence") = 'object')
);

CREATE UNIQUE INDEX "ImageConsentEvent_commandId_key" ON "ImageConsentEvent"("commandId");
CREATE INDEX "ImageConsentEvent_reservationId_effectiveAt_createdAt_idx"
ON "ImageConsentEvent"("reservationId", "effectiveAt", "createdAt");
CREATE INDEX "ImageConsentEvent_legalVersionId_idx" ON "ImageConsentEvent"("legalVersionId");
CREATE INDEX "ImageConsentEvent_choice_effectiveAt_idx" ON "ImageConsentEvent"("choice", "effectiveAt");
CREATE INDEX "ImageConsentEvent_recordedById_idx" ON "ImageConsentEvent"("recordedById");

ALTER TABLE "ImageConsentEvent" ADD CONSTRAINT "ImageConsentEvent_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageConsentEvent" ADD CONSTRAINT "ImageConsentEvent_legalVersionId_fkey"
FOREIGN KEY ("legalVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImageConsentEvent" ADD CONSTRAINT "ImageConsentEvent_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ImageConsentEvent" (
  "id", "reservationId", "legalVersionId", "choice", "purpose", "scope",
  "evidence", "source", "effectiveAt", "createdAt"
)
SELECT
  'image-consent-backfill-' || snapshot."id",
  snapshot."reservationId",
  'legal-image-2026-07-31',
  CASE WHEN snapshot."imageConsent" THEN 'GRANTED' ELSE 'REFUSED' END,
  'PORTFOLIO_AND_PROMOTION',
  '["WEBSITE","INSTAGRAM","TIKTOK"]'::jsonb,
  jsonb_build_object(
    'quality', 'HISTORICAL_SNAPSHOT_BACKFILL',
    'snapshotId', snapshot."id",
    'snapshotVersion', snapshot."imageAuthorizationVersion",
    'originalConsentAt', snapshot."imageConsentAt"
  ),
  'HISTORICAL_SNAPSHOT',
  COALESCE(snapshot."imageConsentAt", snapshot."termsAcceptedAt", snapshot."createdAt"),
  CURRENT_TIMESTAMP
FROM "ReservationSnapshot" snapshot;

CREATE FUNCTION "gsp_prevent_image_consent_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM "Reservation" WHERE "id" = OLD."reservationId"
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'IMAGE_CONSENT_EVENT_IMMUTABLE';
END;
$$;

CREATE TRIGGER "ImageConsentEvent_immutable"
BEFORE UPDATE OR DELETE ON "ImageConsentEvent"
FOR EACH ROW EXECUTE FUNCTION "gsp_prevent_image_consent_event_mutation"();
