import type { Clock, IdGenerator, RoomCodeGenerator, RoomRepository } from "@/application/ports";
import { isDomainError, roomCodeExhausted } from "@/domain/errors";
import { Room } from "@/domain/room/Room";

const MAX_CODE_ATTEMPTS = 5;

export class CreateRoom {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly codes: RoomCodeGenerator,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: { hostId: string }): Promise<Room> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const room = Room.open({
        id: this.ids.next(),
        code: this.codes.generate(),
        hostId: input.hostId,
        now: this.clock(),
      });
      try {
        await this.rooms.create(room);
        return room;
      } catch (err) {
        // Collisions are rare (31^6 codes); the unique index is the source of truth, so just redraw.
        if (isDomainError(err) && err.code === "ROOM_CODE_TAKEN") continue;
        throw err;
      }
    }
    throw roomCodeExhausted();
  }
}
