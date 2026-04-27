-- Provenance for assistant chat rows (model vs app/git vs commit chip)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "assistantSource" TEXT;

UPDATE "Message"
SET "assistantSource" = 'commit'
WHERE "role" = 'assistant' AND "commitHash" IS NOT NULL AND ("assistantSource" IS NULL OR "assistantSource" = '');

UPDATE "Message"
SET "assistantSource" = 'model'
WHERE "role" = 'assistant' AND "commitHash" IS NULL AND "assistantSource" IS NULL;
