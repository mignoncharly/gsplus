-- §7: received requests.
--
-- Creative-services requests and photo quotes both landed as QUOTE, so the two were
-- indistinguishable in the list the studio works from. CREATIVE separates them, and the
-- existing rows are re-filed by the subject the public form wrote, which is the only
-- evidence of their origin that was kept.
ALTER TYPE "LeadType" ADD VALUE IF NOT EXISTS 'CREATIVE';

-- The report asks for Nouveau / En cours / Traité / Archivé, not a sales pipeline.
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'HANDLED';

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "internalNote" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "handledAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "handledById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_handledById_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_handledById_fkey"
      FOREIGN KEY ("handledById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Lead_handledById_idx" ON "Lead"("handledById");
