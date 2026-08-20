-- Persist the language selected by a public contact at the time of submission.
-- Historical records retain French, the existing published source language.
ALTER TABLE "ReservationSnapshot"
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fr';

ALTER TABLE "Lead"
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fr';

ALTER TABLE "ReservationSnapshot"
  ADD CONSTRAINT "ReservationSnapshot_locale_check" CHECK ("locale" IN ('fr', 'en'));

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_locale_check" CHECK ("locale" IN ('fr', 'en'));
