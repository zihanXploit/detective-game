import type { RoomRepository } from "@/application/ports";
import type { PlayerRole } from "@/domain/room/Room";
import { loadRoom } from "./loadRoom";

export class ChooseRole {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: { code: string; playerId: string; role: PlayerRole | null }): Promise<void> {
    const room = await loadRoom(this.rooms, input.code);
    // The in-memory check can race with the partner picking the same role;
    // the unique (room, role) constraint settles it.
    await this.rooms.updateMember(room.id, room.chooseRole(input.playerId, input.role));
  }
}
