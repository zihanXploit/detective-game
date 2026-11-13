import type { GameSessionRepository, RoomRepository } from "@/application/ports";
import { projectFor, type PlayerGameView } from "@/domain/game/GameState";
import { loadGame } from "./gameSession";

/** What one player may see of their room's game. Also the resync path after a reconnect. */
export class GetGameView {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly sessions: GameSessionRepository,
  ) {}

  async execute(input: { code: string; playerId: string }): Promise<PlayerGameView> {
    const { session, role } = await loadGame(this.rooms, this.sessions, input);
    return projectFor(session.state, role);
  }
}
