import type { RoomRepository } from "@/application/ports";
import { roomLocked } from "@/domain/errors";
import { loadRoom } from "./loadRoom";

/**
 * Closes the lobby. For now this only moves the room to IN_PROGRESS;
 * creating the game session is the case engine's job and will hook in here.
 */
export class StartCase {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: { code: string; playerId: string }): Promise<void> {
    const room = await loadRoom(this.rooms, input.code);
    room.start(input.playerId);
    if (!(await this.rooms.markStarted(room.id))) throw roomLocked();
  }
}
