-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('A', 'B');

-- AlterTable
ALTER TABLE "room_members" ADD COLUMN     "role" "PlayerRole";

-- CreateIndex
CREATE UNIQUE INDEX "room_members_roomId_role_key" ON "room_members"("roomId", "role");

