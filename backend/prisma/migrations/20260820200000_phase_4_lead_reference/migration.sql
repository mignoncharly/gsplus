ALTER TABLE "Lead" ADD COLUMN "reference" TEXT;

UPDATE "Lead"
SET "reference" = CASE "type"
  WHEN 'CONTACT' THEN 'CONTACT-'
  WHEN 'B2B' THEN 'B2B-'
  ELSE 'DEVIS-'
END || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 10));

ALTER TABLE "Lead" ALTER COLUMN "reference" SET NOT NULL;
CREATE UNIQUE INDEX "Lead_reference_key" ON "Lead"("reference");

DROP TRIGGER IF EXISTS "Lead_reference_immutable_update" ON "Lead";
CREATE TRIGGER "Lead_reference_immutable_update"
BEFORE UPDATE OF "reference" ON "Lead"
FOR EACH ROW
EXECUTE FUNCTION "prevent_public_reference_update"();
