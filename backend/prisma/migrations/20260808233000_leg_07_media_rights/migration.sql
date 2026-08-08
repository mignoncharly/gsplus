-- LEG-07: bind every public media use to an explicit, reviewable rights basis.
ALTER TABLE "MediaItem"
  ADD COLUMN "rightsBasis" TEXT,
  ADD COLUMN "rightsEvidence" JSONB,
  ADD COLUMN "reservationId" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "unpublishedAt" TIMESTAMP(3);

ALTER TABLE "MediaItem" ALTER COLUMN "isPublished" SET DEFAULT false;

UPDATE "MediaItem"
SET
  "rightsBasis" = 'OWNER_APPROVED_CATALOG',
  "rightsEvidence" = jsonb_build_object(
    'manifest', 'private-media/phase8-curated/manifest.json',
    'approvedAt', '2026-07-24T22:56:40.029Z',
    'approvalBasis', 'Explicit owner authorization in the production deployment session',
    'assetUrl', "url"
  ),
  "publishedAt" = COALESCE("updatedAt", "createdAt")
WHERE "url" LIKE '/uploads/portfolio/owner-approved-%';

CREATE TABLE "MediaConsentUsage" (
  "id" TEXT NOT NULL,
  "mediaItemId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "grantEventId" TEXT NOT NULL,
  "withdrawalEventId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "purpose" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deactivatedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaConsentUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaConsentUsage_mediaItemId_grantEventId_key"
  ON "MediaConsentUsage"("mediaItemId", "grantEventId");
CREATE INDEX "MediaConsentUsage_reservationId_status_idx"
  ON "MediaConsentUsage"("reservationId", "status");
CREATE INDEX "MediaConsentUsage_grantEventId_idx" ON "MediaConsentUsage"("grantEventId");
CREATE INDEX "MediaConsentUsage_withdrawalEventId_idx" ON "MediaConsentUsage"("withdrawalEventId");
CREATE INDEX "MediaConsentUsage_publishedById_idx" ON "MediaConsentUsage"("publishedById");
CREATE INDEX "MediaItem_rightsBasis_isPublished_idx" ON "MediaItem"("rightsBasis", "isPublished");
CREATE INDEX "MediaItem_reservationId_idx" ON "MediaItem"("reservationId");

ALTER TABLE "MediaItem"
  ADD CONSTRAINT "MediaItem_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaConsentUsage"
  ADD CONSTRAINT "MediaConsentUsage_mediaItemId_fkey"
  FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MediaConsentUsage_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MediaConsentUsage_grantEventId_fkey"
  FOREIGN KEY ("grantEventId") REFERENCES "ImageConsentEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MediaConsentUsage_withdrawalEventId_fkey"
  FOREIGN KEY ("withdrawalEventId") REFERENCES "ImageConsentEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MediaConsentUsage_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MediaItem"
  ADD CONSTRAINT "MediaItem_rights_basis_check" CHECK (
    (
      "rightsBasis" IS NULL
      AND "reservationId" IS NULL
      AND "isPublished" = false
    )
    OR (
      "rightsBasis" = 'OWNER_APPROVED_CATALOG'
      AND "rightsEvidence" IS NOT NULL
      AND "reservationId" IS NULL
    )
    OR (
      "rightsBasis" = 'CUSTOMER_IMAGE_AUTHORIZATION'
      AND "reservationId" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "MediaItem_published_at_check" CHECK (
    "isPublished" = false OR "publishedAt" IS NOT NULL
  );

ALTER TABLE "MediaConsentUsage"
  ADD CONSTRAINT "MediaConsentUsage_status_check"
    CHECK ("status" IN ('ACTIVE', 'UNPUBLISHED', 'WITHDRAWN')),
  ADD CONSTRAINT "MediaConsentUsage_deactivation_check" CHECK (
    (
      "status" = 'ACTIVE'
      AND "deactivatedAt" IS NULL
      AND "withdrawalEventId" IS NULL
    )
    OR (
      "status" = 'UNPUBLISHED'
      AND "deactivatedAt" IS NOT NULL
      AND "withdrawalEventId" IS NULL
    )
    OR (
      "status" = 'WITHDRAWN'
      AND "deactivatedAt" IS NOT NULL
      AND "withdrawalEventId" IS NOT NULL
    )
  );

CREATE FUNCTION "gsp_validate_media_consent_usage"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  grant_event "ImageConsentEvent"%ROWTYPE;
  withdrawal_event "ImageConsentEvent"%ROWTYPE;
  current_event_id TEXT;
BEGIN
  SELECT * INTO grant_event
  FROM "ImageConsentEvent"
  WHERE "id" = NEW."grantEventId";

  IF NOT FOUND
    OR grant_event."reservationId" <> NEW."reservationId"
    OR grant_event."choice" <> 'GRANTED'
    OR grant_event."purpose" <> NEW."purpose"
    OR grant_event."scope" <> NEW."scope"
    OR NOT (grant_event."scope" @> '["WEBSITE"]'::jsonb)
  THEN
    RAISE EXCEPTION 'MEDIA_CONSENT_GRANT_INVALID';
  END IF;

  SELECT "id" INTO current_event_id
  FROM "ImageConsentEvent"
  WHERE "reservationId" = NEW."reservationId"
  ORDER BY "effectiveAt" DESC, "createdAt" DESC
  LIMIT 1;

  IF NEW."status" = 'ACTIVE' AND current_event_id <> NEW."grantEventId" THEN
    RAISE EXCEPTION 'MEDIA_CONSENT_NOT_CURRENT';
  END IF;

  IF NEW."withdrawalEventId" IS NOT NULL THEN
    SELECT * INTO withdrawal_event
    FROM "ImageConsentEvent"
    WHERE "id" = NEW."withdrawalEventId";

    IF NOT FOUND
      OR withdrawal_event."reservationId" <> NEW."reservationId"
      OR withdrawal_event."choice" <> 'WITHDRAWN'
    THEN
      RAISE EXCEPTION 'MEDIA_CONSENT_WITHDRAWAL_INVALID';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "MediaConsentUsage_validate"
AFTER INSERT OR UPDATE ON "MediaConsentUsage"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "gsp_validate_media_consent_usage"();

CREATE FUNCTION "gsp_enforce_media_publication_rights"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."isPublished" THEN
    IF NEW."rightsBasis" = 'OWNER_APPROVED_CATALOG' AND NEW."rightsEvidence" IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF NEW."rightsBasis" = 'CUSTOMER_IMAGE_AUTHORIZATION'
      AND NEW."reservationId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "MediaConsentUsage" usage
        WHERE usage."mediaItemId" = NEW."id"
          AND usage."reservationId" = NEW."reservationId"
          AND usage."status" = 'ACTIVE'
      )
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'MEDIA_PUBLICATION_RIGHTS_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "MediaItem_publication_rights"
AFTER INSERT OR UPDATE OF "isPublished", "rightsBasis", "rightsEvidence", "reservationId"
ON "MediaItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "gsp_enforce_media_publication_rights"();

CREATE FUNCTION "gsp_apply_image_consent_withdrawal"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."choice" = 'WITHDRAWN' THEN
    UPDATE "MediaConsentUsage"
    SET
      "status" = 'WITHDRAWN',
      "withdrawalEventId" = NEW."id",
      "deactivatedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "reservationId" = NEW."reservationId"
      AND "status" = 'ACTIVE';

    UPDATE "MediaItem"
    SET
      "isPublished" = false,
      "isFeatured" = false,
      "unpublishedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" IN (
      SELECT "mediaItemId"
      FROM "MediaConsentUsage"
      WHERE "withdrawalEventId" = NEW."id"
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ImageConsentEvent_apply_media_withdrawal"
AFTER INSERT ON "ImageConsentEvent"
FOR EACH ROW EXECUTE FUNCTION "gsp_apply_image_consent_withdrawal"();
