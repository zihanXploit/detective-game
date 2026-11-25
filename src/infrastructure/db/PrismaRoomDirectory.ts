import type { PrismaClient } from "@prisma/client";
import type { RoomDirectory, RoomListEntry } from "@/application/ports";

/**
 * Read model for "rooms you can come back to". Queried directly rather than
 * through the Room aggregate: this never needs the rules, only a few columns.
 */
export class PrismaRoomDirectory implements RoomDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async listForPlayer(playerId: string, limit: number): Promise<RoomListEntry[]> {
    const rows = await this.prisma.room.findMany({
      where: { members: { some: { playerId } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        code: true,
        status: true,
        caseSlug: true,
        updatedAt: true,
        members: { select: { playerId: true, player: { select: { displayName: true } } } },
      },
    });

    return rows.map((row) => ({
      code: row.code,
      status: row.status,
      caseSlug: row.caseSlug,
      partnerName: row.members.find((m) => m.playerId !== playerId)?.player.displayName ?? null,
      lastActiveAt: row.updatedAt,
    }));
  }
}
