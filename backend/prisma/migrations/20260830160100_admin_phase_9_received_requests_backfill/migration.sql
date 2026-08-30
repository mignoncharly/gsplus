-- Separate migration: PostgreSQL refuses to use an enum value added in the same
-- transaction that created it.

-- Re-file the creative requests. The public form wrote "Service créatif" or "Creative
-- service" into the subject, and that string is the only record of which form a request
-- came from, so it is what the backfill reads. A photo quote keeps QUOTE.
UPDATE "Lead"
SET type = 'CREATIVE'
WHERE type = 'QUOTE'
  AND (subject ILIKE '%service créatif%' OR subject ILIKE '%creative service%');

-- WON and LOST were a sales pipeline the report explicitly does not want. Both mean the
-- studio finished with the request, which is what "Traité" says.
UPDATE "Lead" SET status = 'HANDLED' WHERE status IN ('WON', 'LOST');
