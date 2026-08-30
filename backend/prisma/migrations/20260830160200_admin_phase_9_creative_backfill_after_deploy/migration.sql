-- The same re-filing as the previous migration, deliberately repeated.
--
-- A running server holds a Prisma client compiled against the enum it was built with, so
-- a row carrying a value that client has never heard of makes every read of that table
-- fail. Adding the enum value is safe ahead of a deployment; writing it into a row is not.
-- This migration exists so the data change lands after the new code is running, and it is
-- written to be a no-op wherever the previous migration already did the work.
UPDATE "Lead"
SET type = 'CREATIVE'
WHERE type = 'QUOTE'
  AND (subject ILIKE '%service créatif%' OR subject ILIKE '%creative service%');
