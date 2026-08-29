-- Admin analysis Phase 3 (ADM-04): payment verification queue.
--
-- `Payment.amount` already holds the expected amount, frozen from the package price
-- at creation. Nothing captured what the studio actually observed on the operator
-- statement, so the report's "montant attendu/déclaré" comparison had no second term.
-- `declaredAmount` adds it. It is nullable and is never backfilled from `amount`:
-- a null means "not yet recorded", which is the truth for every existing row.
ALTER TABLE "Payment" ADD COLUMN "declaredAmount" INTEGER;

-- The unique index on (method, transactionRefNormalized) already refuses a duplicate
-- reference. It never showed the pair. This links a payment to the one it duplicates
-- so both can be presented together.
ALTER TABLE "Payment" ADD COLUMN "duplicateOfPaymentId" TEXT;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_duplicateOfPaymentId_fkey"
  FOREIGN KEY ("duplicateOfPaymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_duplicateOfPaymentId_idx" ON "Payment"("duplicateOfPaymentId");

-- Supports the verification queue: free-text search on the normalised reference and
-- the default ordering by status and age.
CREATE INDEX "Payment_transactionRefNormalized_idx" ON "Payment"("transactionRefNormalized");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
