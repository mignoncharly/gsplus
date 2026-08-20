ALTER TABLE "ReservationTransition" ADD COLUMN "internalReason" TEXT, ADD COLUMN "customerReasonCode" TEXT, ADD COLUMN "customerReasonText" TEXT, ADD COLUMN "customerLocale" TEXT, ADD COLUMN "customerCopyVersion" TEXT;
ALTER TABLE "PaymentTransition" ADD COLUMN "internalReason" TEXT, ADD COLUMN "customerReasonCode" TEXT, ADD COLUMN "customerReasonText" TEXT, ADD COLUMN "customerLocale" TEXT, ADD COLUMN "customerCopyVersion" TEXT;
ALTER TABLE "ReservationRescheduleRequest" ADD COLUMN "internalDecisionReason" TEXT, ADD COLUMN "customerReasonCode" TEXT, ADD COLUMN "customerReasonText" TEXT, ADD COLUMN "customerLocale" TEXT, ADD COLUMN "customerCopyVersion" TEXT;
ALTER TABLE "ReservationWithdrawalRequest" ADD COLUMN "internalDecisionReason" TEXT, ADD COLUMN "customerReasonCode" TEXT, ADD COLUMN "customerReasonText" TEXT, ADD COLUMN "customerLocale" TEXT, ADD COLUMN "customerCopyVersion" TEXT;

UPDATE "ReservationTransition" SET "internalReason" = "reason" WHERE "reason" IS NOT NULL;
UPDATE "PaymentTransition" SET "internalReason" = "reason" WHERE "reason" IS NOT NULL;
UPDATE "ReservationRescheduleRequest" SET "internalDecisionReason" = "decisionReason" WHERE "decisionReason" IS NOT NULL;
UPDATE "ReservationWithdrawalRequest" SET "internalDecisionReason" = "decisionReason" WHERE "decisionReason" IS NOT NULL;

ALTER TABLE "ReservationTransition" ADD CONSTRAINT "ReservationTransition_customerLocale_check" CHECK ("customerLocale" IS NULL OR "customerLocale" IN ('fr', 'en'));
ALTER TABLE "PaymentTransition" ADD CONSTRAINT "PaymentTransition_customerLocale_check" CHECK ("customerLocale" IS NULL OR "customerLocale" IN ('fr', 'en'));
ALTER TABLE "ReservationRescheduleRequest" ADD CONSTRAINT "ReservationRescheduleRequest_customerLocale_check" CHECK ("customerLocale" IS NULL OR "customerLocale" IN ('fr', 'en'));
ALTER TABLE "ReservationWithdrawalRequest" ADD CONSTRAINT "ReservationWithdrawalRequest_customerLocale_check" CHECK ("customerLocale" IS NULL OR "customerLocale" IN ('fr', 'en'));
