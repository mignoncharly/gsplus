CREATE TYPE "ReservationScheduleKind" AS ENUM ('STANDARD_HOLD', 'CUSTOM_PROPOSAL');

ALTER TABLE "ReservationIntent"
  ADD COLUMN "scheduleKind" "ReservationScheduleKind" NOT NULL DEFAULT 'STANDARD_HOLD',
  ADD COLUMN "requestedStartAt" TIMESTAMP(3),
  ADD COLUMN "requestedEndAt" TIMESTAMP(3),
  ADD COLUMN "requestedTimeZone" TEXT NOT NULL DEFAULT 'Africa/Douala';

ALTER TABLE "Reservation"
  ADD COLUMN "scheduleKind" "ReservationScheduleKind" NOT NULL DEFAULT 'STANDARD_HOLD',
  ADD COLUMN "requestedStartAt" TIMESTAMP(3),
  ADD COLUMN "requestedEndAt" TIMESTAMP(3),
  ADD COLUMN "requestedTimeZone" TEXT NOT NULL DEFAULT 'Africa/Douala',
  ADD COLUMN "scheduleConfirmedAt" TIMESTAMP(3);

ALTER TABLE "ReservationSnapshot"
  ADD COLUMN "scheduleKind" "ReservationScheduleKind" NOT NULL DEFAULT 'STANDARD_HOLD',
  ADD COLUMN "requestedStartAt" TIMESTAMP(3),
  ADD COLUMN "requestedEndAt" TIMESTAMP(3),
  ADD COLUMN "requestedTimeZone" TEXT NOT NULL DEFAULT 'Africa/Douala';

UPDATE "ReservationIntent" SET "requestedStartAt" = "startAt", "requestedEndAt" = "endAt";
UPDATE "Reservation" SET "requestedStartAt" = "startAt", "requestedEndAt" = "endAt",
  "scheduleConfirmedAt" = CASE WHEN "status" = 'CONFIRMED' THEN "statusChangedAt" ELSE NULL END;
ALTER TABLE "ReservationSnapshot" DISABLE TRIGGER "ReservationSnapshot_immutable_update";
UPDATE "ReservationSnapshot" SET "requestedStartAt" = "startAt", "requestedEndAt" = "endAt";
ALTER TABLE "ReservationSnapshot" ENABLE TRIGGER "ReservationSnapshot_immutable_update";

ALTER TABLE "ReservationIntent" ADD CONSTRAINT "ReservationIntent_custom_proposal_requested_time_check" CHECK ("scheduleKind" <> 'CUSTOM_PROPOSAL' OR ("requestedStartAt" IS NOT NULL AND "requestedEndAt" IS NOT NULL));
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_custom_proposal_requested_time_check" CHECK ("scheduleKind" <> 'CUSTOM_PROPOSAL' OR ("requestedStartAt" IS NOT NULL AND "requestedEndAt" IS NOT NULL));
ALTER TABLE "ReservationSnapshot" ADD CONSTRAINT "ReservationSnapshot_custom_proposal_requested_time_check" CHECK ("scheduleKind" <> 'CUSTOM_PROPOSAL' OR ("requestedStartAt" IS NOT NULL AND "requestedEndAt" IS NOT NULL));

CREATE INDEX "Reservation_scheduleKind_startAt_endAt_idx" ON "Reservation"("scheduleKind", "startAt", "endAt");
CREATE INDEX "ReservationIntent_scheduleKind_startAt_endAt_expiresAt_idx" ON "ReservationIntent"("scheduleKind", "startAt", "endAt", "expiresAt");
