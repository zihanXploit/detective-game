import type { PlayerGameView } from "@/shared/realtime/contract";
import { buildPlayerView, loadGame, type GameDeps } from "./gameSession";

/** What one player may see of their room's game. Also the resync path after a reconnect. */
export class GetGameView {
  constructor(private readonly deps: GameDeps) {}

  async execute(input: { code: string; playerId: string }): Promise<PlayerGameView> {
    const { session, definition, role } = await loadGame(this.deps, input);
    return buildPlayerView(definition, session.state, role);
  }
}
