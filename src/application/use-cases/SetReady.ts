import type { RoomRepository } from "@/application/ports";
import { roomNotFound } from "@/domain/errors";
import { parseRoomCode } from "@/domain/room/RoomCode";

export class SetReady {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: { code: string; playerId: string; isReady: boolean }): Promise<void> {
    const room = await this.rooms.findByCode(parseRoomCode(input.code));
    if (!room) throw roomNotFound();

    const member = room.setReady(input.playerId, input.isReady);
    await this.rooms.setMemberReady(room.id, member.playerId, member.isReady);
  }
}
