-- A fallback channel was declared but nothing ever read it, and WhatsApp is switched off
-- in production. A column an owner could set and no code would honour is worse than no
-- column at all, so it goes before any row exists.
ALTER TABLE "MessageRule" DROP COLUMN IF EXISTS "fallbackChannel";
