import type { GameSessionRepository, RoomRepository } from "@/application/ports";
import { roomLocked } from "@/domain/errors";
import { openSession } from "./gameSession";
import { loadRoom } from "./loadRoom";

/** Closes the lobby and opens the room's game session. */
export class StartCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly sessions: GameSessionRepository,
  ) {}

  async execute(input: { code: string; playerId: string }): Promise<void> {
    const room = await loadRoom(this.rooms, input.code);
    room.start(input.playerId);
    if (!(await this.rooms.markStarted(room.id))) throw roomLocked();
    await openSession(this.sessions, room);
  }
}
