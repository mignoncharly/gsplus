DO $$
BEGIN
  CREATE TYPE "PackageVersionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "publishedVersion" INTEGER;

ALTER TABLE "PackageVersion"
  ADD COLUMN IF NOT EXISTS "content" TEXT,
  ADD COLUMN IF NOT EXISTS "inclusions" JSONB,
  ADD COLUMN IF NOT EXISTS "conditions" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "PackageVersionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "effectiveAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedById" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "PackageVersion"
SET
  "content" = COALESCE("description", "name"),
  "inclusions" = COALESCE("options", '[]'::jsonb),
  "conditions" = COALESCE("legalText", "description", "name"),
  "status" = 'PUBLISHED',
  "effectiveAt" = "createdAt",
  "publishedAt" = "createdAt",
  "publishedById" = "createdById";

UPDATE "Package" p
SET "publishedVersion" = p."version"
WHERE EXISTS (
  SELECT 1 FROM "PackageVersion" pv
  WHERE pv."packageId" = p."id" AND pv."version" = p."version"
);

ALTER TABLE "ReservationSnapshot"
  ADD COLUMN IF NOT EXISTS "packageContent" TEXT,
  ADD COLUMN IF NOT EXISTS "packageInclusions" JSONB,
  ADD COLUMN IF NOT EXISTS "packageConditions" TEXT,
  ADD COLUMN IF NOT EXISTS "packageLegalText" TEXT,
  ADD COLUMN IF NOT EXISTS "packageEffectiveAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "packagePublishedAt" TIMESTAMP(3);

ALTER TABLE "ReservationSnapshot" DISABLE TRIGGER "ReservationSnapshot_immutable_update";

UPDATE "ReservationSnapshot" rs
SET
  "packageContent" = pv."content",
  "packageInclusions" = pv."inclusions",
  "packageConditions" = pv."conditions",
  "packageLegalText" = pv."legalText",
  "packageEffectiveAt" = pv."effectiveAt",
  "packagePublishedAt" = pv."publishedAt"
FROM "PackageVersion" pv
WHERE pv."id" = rs."packageVersionId";

ALTER TABLE "ReservationSnapshot" ENABLE TRIGGER "ReservationSnapshot_immutable_update";

ALTER TABLE "ReservationIntent" ADD COLUMN IF NOT EXISTS "packageVersionId" TEXT;

UPDATE "ReservationIntent" ri
SET "packageVersionId" = pv."id"
FROM "Package" p
JOIN "PackageVersion" pv
  ON pv."packageId" = p."id" AND pv."version" = p."publishedVersion"
WHERE ri."packageId" = p."id";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageVersion_validatedById_fkey') THEN
    ALTER TABLE "PackageVersion" ADD CONSTRAINT "PackageVersion_validatedById_fkey"
      FOREIGN KEY ("validatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageVersion_publishedById_fkey') THEN
    ALTER TABLE "PackageVersion" ADD CONSTRAINT "PackageVersion_publishedById_fkey"
      FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReservationIntent_packageVersionId_fkey') THEN
    ALTER TABLE "ReservationIntent" ADD CONSTRAINT "ReservationIntent_packageVersionId_fkey"
      FOREIGN KEY ("packageVersionId") REFERENCES "PackageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PackageVersion_packageId_status_version_idx" ON "PackageVersion"("packageId", "status", "version");
CREATE INDEX IF NOT EXISTS "PackageVersion_validatedById_idx" ON "PackageVersion"("validatedById");
CREATE INDEX IF NOT EXISTS "PackageVersion_publishedById_idx" ON "PackageVersion"("publishedById");
CREATE INDEX IF NOT EXISTS "ReservationIntent_packageVersionId_idx" ON "ReservationIntent"("packageVersionId");
