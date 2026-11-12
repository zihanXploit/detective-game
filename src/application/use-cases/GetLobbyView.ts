import type { PlayerRepository, PresenceTracker, RoomRepository } from "@/application/ports";
import { notRoomMember, roomNotFound } from "@/domain/errors";
import { ROOM_CAPACITY } from "@/domain/room/Room";
import { parseRoomCode } from "@/domain/room/RoomCode";
import type { LobbyView } from "@/shared/realtime/contract";

/** Read model for the lobby screen. Only members may see it. */
export class GetLobbyView {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly players: PlayerRepository,
    private readonly presence: PresenceTracker,
  ) {}

  async execute(input: { code: string; requesterId: string }): Promise<LobbyView> {
    const room = await this.rooms.findByCode(parseRoomCode(input.code));
    if (!room) throw roomNotFound();
    if (!room.findMember(input.requesterId)) throw notRoomMember();

    const [players, online] = await Promise.all([
      this.players.findByIds(room.members.map((m) => m.playerId)),
      this.presence.onlinePlayerIds(room.code),
    ]);
    const names = new Map(players.map((p) => [p.id, p.displayName]));

    return {
      code: room.code,
      status: room.status,
      capacity: ROOM_CAPACITY,
      canStart: room.canStart,
      members: room.members.map((m) => ({
        playerId: m.playerId,
        displayName: names.get(m.playerId) ?? "Unknown",
        seat: m.seat,
        isReady: m.isReady,
        isOnline: online.has(m.playerId),
        isHost: m.playerId === room.hostId,
      })),
    };
  }
}
