CREATE OR REPLACE FUNCTION "prevent_public_reference_update"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."reference" IS DISTINCT FROM OLD."reference" THEN
    RAISE EXCEPTION 'PUBLIC_REFERENCE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Reservation_reference_immutable_update" ON "Reservation";
CREATE TRIGGER "Reservation_reference_immutable_update"
BEFORE UPDATE OF "reference" ON "Reservation"
FOR EACH ROW
EXECUTE FUNCTION "prevent_public_reference_update"();

DROP TRIGGER IF EXISTS "ReservationIntent_reference_immutable_update" ON "ReservationIntent";
CREATE TRIGGER "ReservationIntent_reference_immutable_update"
BEFORE UPDATE OF "reference" ON "ReservationIntent"
FOR EACH ROW
EXECUTE FUNCTION "prevent_public_reference_update"();
