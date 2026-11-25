import { stateConflict } from "@/domain/errors";
import { applyAction, type GameAction } from "@/domain/game/GameState";
import { PLAYER_ROLES } from "@/domain/room/Room";
import type { PlayerGameView } from "@/shared/realtime/contract";
import { buildPlayerView, loadGame, type GameDeps } from "./gameSession";

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
  constructor(private readonly deps: GameDeps) {}

  async execute(input: { code: string; playerId: string; action: GameAction }): Promise<PlayerViewUpdate[]> {
    const { session, definition, role } = await loadGame(this.deps, input);

    const next = applyAction(definition, session.state, role, input.action);
    const saved = await this.deps.sessions.save(session.id, next, session.version);
    if (!saved) throw stateConflict();

    return PLAYER_ROLES.map((r) => ({
      playerId: next.players[r].playerId,
      view: buildPlayerView(definition, next, r),
    }));
  }
}
