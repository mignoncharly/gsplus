-- Add optional manual payment metadata captured from customers.
ALTER TABLE "Payment" ADD COLUMN "paymentPhone" TEXT;

CREATE INDEX "Payment_paymentPhone_idx" ON "Payment"("paymentPhone");
