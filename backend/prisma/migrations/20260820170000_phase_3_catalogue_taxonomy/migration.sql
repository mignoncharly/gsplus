ALTER TABLE "PackageVersion" ADD COLUMN "taxonomyKey" TEXT;
ALTER TABLE "PackageVersion" ADD COLUMN "englishEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CatalogueTaxonomy" (
  "key" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogueTaxonomy_pkey" PRIMARY KEY ("key")
);
CREATE UNIQUE INDEX "CatalogueTaxonomy_sortOrder_key" ON "CatalogueTaxonomy"("sortOrder");
CREATE INDEX "CatalogueTaxonomy_isActive_sortOrder_idx" ON "CatalogueTaxonomy"("isActive", "sortOrder");

CREATE TABLE "CatalogueTaxonomyLocale" (
  "id" TEXT NOT NULL,
  "taxonomyKey" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "CatalogueTaxonomyLocale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CatalogueTaxonomyLocale_taxonomyKey_locale_key" ON "CatalogueTaxonomyLocale"("taxonomyKey", "locale");
CREATE INDEX "CatalogueTaxonomyLocale_locale_idx" ON "CatalogueTaxonomyLocale"("locale");

CREATE TABLE "PackageVersionLocale" (
  "id" TEXT NOT NULL,
  "packageVersionId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "inclusions" JSONB NOT NULL,
  "conditions" TEXT NOT NULL,
  "deliveryLabel" TEXT NOT NULL,
  "mandatoryWording" TEXT NOT NULL,
  "options" JSONB,
  "sourceReference" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "PackageVersionLocale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PackageVersionLocale_packageVersionId_locale_key" ON "PackageVersionLocale"("packageVersionId", "locale");
CREATE INDEX "PackageVersionLocale_locale_isEnabled_idx" ON "PackageVersionLocale"("locale", "isEnabled");

CREATE TABLE "CatalogueBenefit" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "publishedVersion" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogueBenefit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CatalogueBenefit_code_key" ON "CatalogueBenefit"("code");

CREATE TABLE "CatalogueBenefitVersion" (
  "id" TEXT NOT NULL,
  "benefitId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "taxonomyKey" TEXT NOT NULL,
  "applicationMode" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "status" "PackageVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "validatedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogueBenefitVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CatalogueBenefitVersion_benefitId_version_key" ON "CatalogueBenefitVersion"("benefitId", "version");
CREATE INDEX "CatalogueBenefitVersion_benefitId_status_version_idx" ON "CatalogueBenefitVersion"("benefitId", "status", "version");
CREATE INDEX "CatalogueBenefitVersion_taxonomyKey_sortOrder_idx" ON "CatalogueBenefitVersion"("taxonomyKey", "sortOrder");

CREATE TABLE "CatalogueBenefitVersionLocale" (
  "id" TEXT NOT NULL,
  "benefitVersionId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "advantage" TEXT NOT NULL,
  "conditions" TEXT NOT NULL,
  "applicationLabel" TEXT NOT NULL,
  "mandatoryWording" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "CatalogueBenefitVersionLocale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CatalogueBenefitVersionLocale_benefitVersionId_locale_key" ON "CatalogueBenefitVersionLocale"("benefitVersionId", "locale");
CREATE INDEX "CatalogueBenefitVersionLocale_locale_isEnabled_idx" ON "CatalogueBenefitVersionLocale"("locale", "isEnabled");

INSERT INTO "CatalogueTaxonomy" ("key", "sortOrder", "updatedAt") VALUES
('portraits-identite', 10, CURRENT_TIMESTAMP),
('couples-familles-groupes', 20, CURRENT_TIMESTAMP),
('maternite-bebe-enfant', 30, CURRENT_TIMESTAMP),
('anniversaires', 40, CURRENT_TIMESTAMP),
('fiancailles-pre-mariage', 50, CURRENT_TIMESTAMP),
('evenements', 60, CURRENT_TIMESTAMP),
('createurs-entreprises', 70, CURRENT_TIMESTAMP),
('privileges-golden-promotion', 80, CURRENT_TIMESTAMP);

INSERT INTO "CatalogueTaxonomyLocale" ("id", "taxonomyKey", "locale", "label") VALUES
(md5('portraits-identite:fr'), 'portraits-identite', 'fr', 'Portraits & identité'),
(md5('portraits-identite:en'), 'portraits-identite', 'en', 'Portraits & identity'),
(md5('couples-familles-groupes:fr'), 'couples-familles-groupes', 'fr', 'Couples, familles & groupes'),
(md5('couples-familles-groupes:en'), 'couples-familles-groupes', 'en', 'Couples, families & groups'),
(md5('maternite-bebe-enfant:fr'), 'maternite-bebe-enfant', 'fr', 'Maternité, bébé & enfant'),
(md5('maternite-bebe-enfant:en'), 'maternite-bebe-enfant', 'en', 'Maternity, baby & children'),
(md5('anniversaires:fr'), 'anniversaires', 'fr', 'Anniversaires'),
(md5('anniversaires:en'), 'anniversaires', 'en', 'Birthdays'),
(md5('fiancailles-pre-mariage:fr'), 'fiancailles-pre-mariage', 'fr', 'Fiançailles & pré-mariage'),
(md5('fiancailles-pre-mariage:en'), 'fiancailles-pre-mariage', 'en', 'Engagements & pre-wedding'),
(md5('evenements:fr'), 'evenements', 'fr', 'Événements'),
(md5('evenements:en'), 'evenements', 'en', 'Events'),
(md5('createurs-entreprises:fr'), 'createurs-entreprises', 'fr', 'Créateurs & entreprises'),
(md5('createurs-entreprises:en'), 'createurs-entreprises', 'en', 'Creators & businesses'),
(md5('privileges-golden-promotion:fr'), 'privileges-golden-promotion', 'fr', 'Privilèges Golden — Promotion'),
(md5('privileges-golden-promotion:en'), 'privileges-golden-promotion', 'en', 'Golden privileges — Promotion');

UPDATE "PackageVersion" SET "taxonomyKey" = CASE "category"
  WHEN 'Portraits & identité' THEN 'portraits-identite'
  WHEN 'Couples, familles & groupes' THEN 'couples-familles-groupes'
  WHEN 'Maternité, bébé & enfant' THEN 'maternite-bebe-enfant'
  WHEN 'Anniversaires' THEN 'anniversaires'
  WHEN 'Fiançailles & pré-mariage' THEN 'fiancailles-pre-mariage'
  WHEN 'Événements' THEN 'evenements'
  WHEN 'Créateurs & entreprises' THEN 'createurs-entreprises'
  WHEN 'Privilèges Golden' THEN 'privileges-golden-promotion'
  WHEN 'Privilèges Golden — Promotion' THEN 'privileges-golden-promotion'
  WHEN 'Portraits & Individuels' THEN 'portraits-identite'
  WHEN 'Duo, Famille & Enfants' THEN 'couples-familles-groupes'
  WHEN 'Maternite & Naissance' THEN 'maternite-bebe-enfant'
  WHEN 'Fiancailles & Pre-mariage' THEN 'fiancailles-pre-mariage'
  WHEN 'Evenementiel' THEN 'evenements'
END;

INSERT INTO "PackageVersionLocale" ("id", "packageVersionId", "locale", "name", "description", "content", "inclusions", "conditions", "deliveryLabel", "mandatoryWording", "options", "sourceReference", "approvedAt")
SELECT md5(v."id" || ':fr'), v."id", 'fr', v."name", v."description", COALESCE(v."content", v."description", v."name"), COALESCE(v."inclusions", '[]'::jsonb), COALESCE(v."conditions", v."description", v."name"), COALESCE(v."deliveryLabel", 'Pour connaître les modalités et délais de livraison de cette offre, veuillez nous contacter.'), COALESCE(v."legalText", 'Les Conditions générales de vente publiées et acceptées lors de la réservation sont applicables.'), v."options", 'MIGRATION:PackageVersion:2026-08-20', COALESCE(v."legalApprovedAt", v."publishedAt") FROM "PackageVersion" v;

CREATE INDEX "PackageVersion_taxonomyKey_idx" ON "PackageVersion"("taxonomyKey");
ALTER TABLE "PackageVersion" ADD CONSTRAINT "PackageVersion_taxonomyKey_fkey" FOREIGN KEY ("taxonomyKey") REFERENCES "CatalogueTaxonomy"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogueTaxonomyLocale" ADD CONSTRAINT "CatalogueTaxonomyLocale_taxonomyKey_fkey" FOREIGN KEY ("taxonomyKey") REFERENCES "CatalogueTaxonomy"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageVersionLocale" ADD CONSTRAINT "PackageVersionLocale_packageVersionId_fkey" FOREIGN KEY ("packageVersionId") REFERENCES "PackageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogueBenefitVersion" ADD CONSTRAINT "CatalogueBenefitVersion_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "CatalogueBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogueBenefitVersion" ADD CONSTRAINT "CatalogueBenefitVersion_taxonomyKey_fkey" FOREIGN KEY ("taxonomyKey") REFERENCES "CatalogueTaxonomy"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogueBenefitVersion" ADD CONSTRAINT "CatalogueBenefitVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogueBenefitVersion" ADD CONSTRAINT "CatalogueBenefitVersion_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogueBenefitVersion" ADD CONSTRAINT "CatalogueBenefitVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogueBenefitVersionLocale" ADD CONSTRAINT "CatalogueBenefitVersionLocale_benefitVersionId_fkey" FOREIGN KEY ("benefitVersionId") REFERENCES "CatalogueBenefitVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
