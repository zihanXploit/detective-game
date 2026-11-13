-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "caseSlug" VARCHAR(64);

-- Sessions created before the case system used a stand-in case that no longer exists.
-- Drop them and send their rooms back to the lobby so the host can pick a real case.
DELETE FROM "game_sessions" WHERE "caseSlug" = 'placeholder';

-- From here on a started room always has a case.
UPDATE "rooms" SET "status" = 'LOBBY' WHERE "status" = 'IN_PROGRESS' AND "caseSlug" IS NULL;
