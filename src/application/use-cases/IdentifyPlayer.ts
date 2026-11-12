import type { PlayerRepository } from "@/application/ports";
import { parseDisplayName, type Player } from "@/domain/player/Player";

/** Resolves the caller to a Player, creating a guest identity on first contact. */
export class IdentifyPlayer {
  constructor(private readonly players: PlayerRepository) {}

  async execute(input: { playerId: string | null; displayName: string }): Promise<Player> {
    const displayName = parseDisplayName(input.displayName);

    const existing = input.playerId ? await this.players.findById(input.playerId) : null;
    if (!existing) return this.players.create(displayName);
    if (existing.displayName === displayName) return existing;
    return this.players.rename(existing.id, displayName);
  }
}
