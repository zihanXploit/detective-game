import type { RoomRepository } from "@/application/ports";
import { isRoomCode, parseRoomCode, type RoomCode } from "@/domain/room/RoomCode";

export type RoomAccess =
  | { kind: "not_found" }
  | { kind: "member"; code: RoomCode }
  | { kind: "joinable"; code: RoomCode }
  | { kind: "closed"; code: RoomCode };

/** Decides what a visitor to a room URL should see, without changing anything. */
export class CheckRoomAccess {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: { code: string; playerId: string | null }): Promise<RoomAccess> {
    if (!isRoomCode(input.code)) return { kind: "not_found" };

    const room = await this.rooms.findByCode(parseRoomCode(input.code));
    if (!room) return { kind: "not_found" };

    if (input.playerId && room.findMember(input.playerId)) return { kind: "member", code: room.code };
    return { kind: room.isJoinable ? "joinable" : "closed", code: room.code };
  }
}
