import type { PrismaClient } from "@prisma/client";
import type { PlayerRepository } from "@/application/ports";
import type { Player } from "@/domain/player/Player";

const select = { id: true, displayName: true } as const;

export class PrismaPlayerRepository implements PlayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<Player | null> {
    return this.prisma.player.findUnique({ where: { id }, select });
  }

  findByIds(ids: readonly string[]): Promise<Player[]> {
    return this.prisma.player.findMany({ where: { id: { in: [...ids] } }, select });
  }

  create(displayName: string): Promise<Player> {
    return this.prisma.player.create({ data: { displayName }, select });
  }

  rename(id: string, displayName: string): Promise<Player> {
    return this.prisma.player.update({ where: { id }, data: { displayName }, select });
  }
}
