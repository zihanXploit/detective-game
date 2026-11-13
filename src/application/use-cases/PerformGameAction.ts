import type { GameSessionRepository, RoomRepository } from "@/application/ports";
import { stateConflict } from "@/domain/errors";
import { applyAction, projectFor, type GameAction, type PlayerGameView } from "@/domain/game/GameState";
import { PLAYER_ROLES } from "@/domain/room/Room";
import { loadGame } from "./gameSession";

export interface PlayerViewUpdate {
  playerId: string;
  view: PlayerGameView;
}

/**
 * Applies one player's action and saves the result.
 * Returns a separate view for each player; the caller must deliver each one
 * only to its owner.
 */
export class PerformGameAction {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly sessions: GameSessionRepository,
  ) {}

  async execute(input: { code: string; playerId: string; action: GameAction }): Promise<PlayerViewUpdate[]> {
    const { session, role } = await loadGame(this.rooms, this.sessions, input);

    const next = applyAction(session.state, role, input.action);
    const saved = await this.sessions.save(session.id, next, session.version);
    if (!saved) throw stateConflict();

    return PLAYER_ROLES.map((r) => ({ playerId: next.players[r].playerId, view: projectFor(next, r) }));
  }
}
