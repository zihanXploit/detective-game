import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { CaseRef, GameSessionRepository, StoredGameSession } from "@/application/ports";
import type { GameState } from "@/domain/game/GameState";
import { isUniqueViolation } from "./prisma";

const playerSchema = z.object({
  playerId: z.string(),
  briefingAcknowledged: z.boolean(),
  notebook: z.string(),
});

/** Saved state is JSON, so it is checked on the way out: a corrupt or outdated row fails loudly here. */
const stateSchema: z.ZodType<GameState> = z.object({
  phase: z.enum(["BRIEFING", "INVESTIGATION"]),
  players: z.object({ A: playerSchema, B: playerSchema }),
});

const select = { id: true, state: true, stateVersion: true } as const;

const toStored = (row: { id: string; state: Prisma.JsonValue; stateVersion: number }): StoredGameSession => ({
  id: row.id,
  state: stateSchema.parse(row.state),
  version: row.stateVersion,
});

const toJson = (state: GameState) => state as unknown as Prisma.InputJsonValue;

export class PrismaGameSessionRepository implements GameSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByRoom(roomId: string): Promise<StoredGameSession | null> {
    const row = await this.prisma.gameSession.findFirst({ where: { roomId, status: "ACTIVE" }, select });
    return row ? toStored(row) : null;
  }

  async create(roomId: string, caseRef: CaseRef, state: GameState): Promise<StoredGameSession> {
    try {
      const row = await this.prisma.gameSession.create({
        data: { roomId, caseSlug: caseRef.slug, caseVersion: caseRef.version, state: toJson(state) },
        select,
      });
      return toStored(row);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Another request opened the session first; theirs is the one that counts.
      const row = await this.prisma.gameSession.findUniqueOrThrow({
        where: { roomId_caseSlug: { roomId, caseSlug: caseRef.slug } },
        select,
      });
      return toStored(row);
    }
  }

  async save(id: string, state: GameState, expectedVersion: number): Promise<boolean> {
    const { count } = await this.prisma.gameSession.updateMany({
      where: { id, stateVersion: expectedVersion },
      data: { state: toJson(state), stateVersion: { increment: 1 } },
    });
    return count === 1;
  }
}
