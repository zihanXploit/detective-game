import type { RoomRepository } from "@/application/ports";
import { roomNotFound } from "@/domain/errors";
import type { Room } from "@/domain/room/Room";
import { parseRoomCode } from "@/domain/room/RoomCode";

/** Shared first step of every room use case: validate the code and fetch the aggregate. */
export async function loadRoom(rooms: RoomRepository, code: string): Promise<Room> {
  const room = await rooms.findByCode(parseRoomCode(code));
  if (!room) throw roomNotFound();
  return room;
}
