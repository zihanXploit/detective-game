import { caseNotFound, roomLocked } from "@/domain/errors";
import { openSession, type GameDeps } from "./gameSession";
import { loadRoom } from "./loadRoom";

/** Closes the lobby and opens the room's game session for its chosen case. */
export class StartCase {
  constructor(private readonly deps: GameDeps) {}

  async execute(input: { code: string; playerId: string }): Promise<void> {
    const room = await loadRoom(this.deps.rooms, input.code);
    room.start(input.playerId);
    // Checked before the room is marked started, so a case removed from the app cannot strand it.
    if (!room.caseSlug || !this.deps.cases.find(room.caseSlug)) throw caseNotFound();

    if (!(await this.deps.rooms.markStarted(room.id))) throw roomLocked();
    await openSession(this.deps, room);
  }
}
