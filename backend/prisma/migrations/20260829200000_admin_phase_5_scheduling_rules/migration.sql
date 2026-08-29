-- Admin analysis Phase 5 (ADM-05): the studio can change its own schedule.
--
-- Opening hours already existed in BusinessHour but no route ever wrote them, so
-- changing an opening time was a database operation. These three additions give the
-- weekly pattern intra-day breaks, dated exceptions that override it, and an explicit
-- booking policy that was previously hard-coded or buried in Package.options.

ALTER TABLE "BusinessHour" ADD COLUMN "breaks" JSONB;

-- A dated override: a public holiday, an exceptional closure, or a day worked outside
-- the usual hours. One row per business day.
CREATE TABLE "ScheduleException" (
  "id"          TEXT NOT NULL,
  "date"        TEXT NOT NULL,
  "isClosed"    BOOLEAN NOT NULL DEFAULT true,
  "opensAt"     TEXT,
  "closesAt"    TEXT,
  "breaks"      JSONB,
  "reason"      TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleException_date_key" ON "ScheduleException"("date");
CREATE INDEX "ScheduleException_date_idx" ON "ScheduleException"("date");
CREATE INDEX "ScheduleException_createdById_idx" ON "ScheduleException"("createdById");

ALTER TABLE "ScheduleException"
  ADD CONSTRAINT "ScheduleException_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Booking policy: one global row plus optional per-package overrides.
CREATE TABLE "BookingRule" (
  "id"               TEXT NOT NULL,
  "packageId"        TEXT,
  "minNoticeMinutes" INTEGER,
  "horizonDays"      INTEGER,
  "dailyCapacity"    INTEGER,
  "bufferMinutes"    INTEGER,
  "updatedById"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingRule_packageId_key" ON "BookingRule"("packageId");
CREATE INDEX "BookingRule_updatedById_idx" ON "BookingRule"("updatedById");

-- Postgres treats NULLs as distinct in a unique index, so the package-level unique
-- above would happily allow many global rows. A unique index on a constant, limited
-- to the rows with no package, keeps the global policy a singleton.
CREATE UNIQUE INDEX "BookingRule_single_global" ON "BookingRule" ((1)) WHERE "packageId" IS NULL;

ALTER TABLE "BookingRule"
  ADD CONSTRAINT "BookingRule_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingRule"
  ADD CONSTRAINT "BookingRule_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
