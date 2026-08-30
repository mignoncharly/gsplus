-- Admin analysis Phase 6 (ADM-09): ordinary information stops needing a deployment.
--
-- The public phone number lived in four files, payment instructions were translation
-- strings, and SEO copy was a frozen array, so a commercial or legal edit meant a code
-- change. These two tables hold that information instead.
--
-- Both are additive and start empty. A settings group with no row falls back to the
-- compiled default, which is exactly the value that was hard-coded before, so
-- deploying this migration changes nothing that anyone can see.

CREATE TABLE "StudioSetting" (
  "id"          TEXT NOT NULL,
  "group"       TEXT NOT NULL,
  "value"       JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioSetting_group_key" ON "StudioSetting"("group");
CREATE INDEX "StudioSetting_updatedById_idx" ON "StudioSetting"("updatedById");

ALTER TABLE "StudioSetting"
  ADD CONSTRAINT "StudioSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SiteContent" (
  "id"            TEXT NOT NULL,
  "key"           TEXT NOT NULL,
  "locale"        TEXT NOT NULL DEFAULT 'fr',
  "version"       INTEGER NOT NULL DEFAULT 1,
  "status"        TEXT NOT NULL DEFAULT 'DRAFT',
  "body"          JSONB NOT NULL,
  "publishedAt"   TIMESTAMP(3),
  "publishedById" TEXT,
  "updatedById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteContent_key_locale_version_key" ON "SiteContent"("key", "locale", "version");
CREATE INDEX "SiteContent_key_locale_status_idx" ON "SiteContent"("key", "locale", "status");
CREATE INDEX "SiteContent_publishedById_idx" ON "SiteContent"("publishedById");
CREATE INDEX "SiteContent_updatedById_idx" ON "SiteContent"("updatedById");

ALTER TABLE "SiteContent"
  ADD CONSTRAINT "SiteContent_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteContent"
  ADD CONSTRAINT "SiteContent_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
