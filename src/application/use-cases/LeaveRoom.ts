import type { RoomRepository } from "@/application/ports";
import { loadRoom } from "./loadRoom";

export class LeaveRoom {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: { code: string; playerId: string }): Promise<void> {
    const room = await loadRoom(this.rooms, input.code);
    room.leave(input.playerId);
    await this.rooms.removeMember(room, input.playerId);
  }
}
