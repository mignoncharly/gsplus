-- Admin analysis Phase 7 (§8.1, ADM-08b): an administrable message library.
--
-- The code registry in src/emails/templates.ts remains the source of truth. These
-- tables hold *overrides*: rendering consults published rows and falls back to the
-- compiled template whenever none exists or the database is unreachable, so the
-- notification outbox can never lose a template. Both tables start empty, so nothing
-- about what customers receive changes until someone publishes an override.

CREATE TABLE "MessageTemplate" (
  "id"            TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "locale"        TEXT NOT NULL DEFAULT 'fr',
  "version"       INTEGER NOT NULL DEFAULT 1,
  "status"        TEXT NOT NULL DEFAULT 'DRAFT',
  "subject"       TEXT NOT NULL,
  "preheader"     TEXT NOT NULL,
  "body"          JSONB NOT NULL,
  "publishedAt"   TIMESTAMP(3),
  "publishedById" TEXT,
  "updatedById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageTemplate_code_locale_version_key" ON "MessageTemplate"("code", "locale", "version");
CREATE INDEX "MessageTemplate_code_locale_status_idx" ON "MessageTemplate"("code", "locale", "status");
CREATE INDEX "MessageTemplate_status_idx" ON "MessageTemplate"("status");

ALTER TABLE "MessageTemplate"
  ADD CONSTRAINT "MessageTemplate_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageTemplate"
  ADD CONSTRAINT "MessageTemplate_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MessageRule" (
  "event"                 TEXT NOT NULL,
  "delayMinutes"          INTEGER,
  "groupingWindowMinutes" INTEGER,
  "maxAttempts"           INTEGER,
  "fallbackChannel"       TEXT,
  "isEnabled"             BOOLEAN NOT NULL DEFAULT true,
  "updatedById"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageRule_pkey" PRIMARY KEY ("event")
);

CREATE INDEX "MessageRule_updatedById_idx" ON "MessageRule"("updatedById");

ALTER TABLE "MessageRule"
  ADD CONSTRAINT "MessageRule_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
