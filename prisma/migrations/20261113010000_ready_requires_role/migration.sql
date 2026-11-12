-- Rooms created before roles existed could hold players marked ready with no role.
-- Any such room that was started goes back to the lobby so its players can pick roles.
UPDATE "rooms" SET "status" = 'LOBBY'
WHERE "status" = 'IN_PROGRESS'
  AND EXISTS (
    SELECT 1 FROM "room_members" m WHERE m."roomId" = "rooms"."id" AND m."role" IS NULL
  );

UPDATE "room_members" SET "isReady" = false WHERE "isReady" AND "role" IS NULL;

-- Being ready without a role is now impossible at the database level too.
ALTER TABLE "room_members"
  ADD CONSTRAINT "room_members_ready_requires_role" CHECK (NOT "isReady" OR "role" IS NOT NULL);
