import type { RoomRepository } from "@/application/ports";
import { loadRoom } from "./loadRoom";

export class SetReady {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: { code: string; playerId: string; isReady: boolean }): Promise<void> {
    const room = await loadRoom(this.rooms, input.code);
    await this.rooms.updateMember(room.id, room.setReady(input.playerId, input.isReady));
  }
}
