-- Phase E: operator-configurable message headers and terminal fallback policy.
ALTER TABLE "MessageTemplate"
  ADD COLUMN "senderName" TEXT,
  ADD COLUMN "fromAddress" TEXT,
  ADD COLUMN "replyTo" TEXT,
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN "fallbackChannel" TEXT;

ALTER TABLE "MessageRule"
  ADD COLUMN "fallbackChannel" TEXT;
