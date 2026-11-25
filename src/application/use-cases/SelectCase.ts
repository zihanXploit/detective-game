import type { CaseCatalog, RoomRepository } from "@/application/ports";
import { caseNotFound } from "@/domain/errors";
import { loadRoom } from "./loadRoom";

export class SelectCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly cases: CaseCatalog,
  ) {}

  async execute(input: { code: string; playerId: string; caseSlug: string }): Promise<void> {
    if (!this.cases.find(input.caseSlug)) throw caseNotFound();

    const room = await loadRoom(this.rooms, input.code);
    room.selectCase(input.playerId, input.caseSlug);
    await this.rooms.saveCaseSelection(room);
  }
}
