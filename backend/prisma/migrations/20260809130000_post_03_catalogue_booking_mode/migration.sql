DO $$
BEGIN
  CREATE TYPE "PackageBookingMode" AS ENUM ('DIRECT', 'CONTACT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Package"
  ADD COLUMN IF NOT EXISTS "bookingMode" "PackageBookingMode" NOT NULL DEFAULT 'DIRECT',
  ALTER COLUMN "durationMin" DROP NOT NULL;

ALTER TABLE "PackageVersion"
  ADD COLUMN IF NOT EXISTS "bookingMode" "PackageBookingMode" NOT NULL DEFAULT 'DIRECT',
  ALTER COLUMN "durationMin" DROP NOT NULL;

ALTER TABLE "Package" DROP CONSTRAINT IF EXISTS "Package_booking_mode_duration_check";
ALTER TABLE "Package"
  ADD CONSTRAINT "Package_booking_mode_duration_check"
  CHECK (
    ("bookingMode" = 'DIRECT' AND "durationMin" IS NOT NULL AND "durationMin" >= 15)
    OR "bookingMode" = 'CONTACT'
  );

ALTER TABLE "PackageVersion" DROP CONSTRAINT IF EXISTS "PackageVersion_booking_mode_duration_check";
ALTER TABLE "PackageVersion"
  ADD CONSTRAINT "PackageVersion_booking_mode_duration_check"
  CHECK (
    ("bookingMode" = 'DIRECT' AND "durationMin" IS NOT NULL AND "durationMin" >= 15)
    OR "bookingMode" = 'CONTACT'
  );
