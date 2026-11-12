import type { Clock, RoomRepository } from "@/application/ports";
import { roomNotFound } from "@/domain/errors";
import type { Room } from "@/domain/room/Room";
import { parseRoomCode } from "@/domain/room/RoomCode";

export class JoinRoom {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { code: string; playerId: string }): Promise<Room> {
    const room = await this.rooms.findByCode(parseRoomCode(input.code));
    if (!room) throw roomNotFound();

    const { member, isNew } = room.admit(input.playerId, this.clock());
    // The in-memory check above can race with another joiner; the repository's
    // unique (room, seat) constraint settles it and surfaces ROOM_FULL to the loser.
    if (isNew) await this.rooms.addMember(room.id, member);
    return room;
  }
}
