import type { CaseCatalog, RoomDirectory } from "@/application/ports";

export interface ResumableRoom {
  code: string;
  /** The case's title, or null if the host has not chosen one yet. */
  caseTitle: string | null;
  partnerName: string | null;
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED";
  lastActiveAt: string;
}

const MAX_ROOMS = 5;

/** The rooms this player can walk back into, newest first. */
export class ListResumableRooms {
  constructor(
    private readonly directory: RoomDirectory,
    private readonly cases: CaseCatalog,
  ) {}

  async execute(playerId: string | null): Promise<ResumableRoom[]> {
    if (!playerId) return [];

    const rooms = await this.directory.listForPlayer(playerId, MAX_ROOMS);
    return rooms.map((room) => ({
      code: room.code,
      // A case can be withdrawn from the app while rooms still point at it.
      caseTitle: room.caseSlug ? (this.cases.find(room.caseSlug)?.title ?? null) : null,
      partnerName: room.partnerName,
      status: room.status,
      lastActiveAt: room.lastActiveAt.toISOString(),
    }));
  }
}
