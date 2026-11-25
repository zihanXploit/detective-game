import type { PlayerRepository, PresenceTracker, RoomRepository } from "@/application/ports";
import { notRoomMember } from "@/domain/errors";
import { ROOM_CAPACITY, type Room } from "@/domain/room/Room";
import { isRoomCode, parseRoomCode } from "@/domain/room/RoomCode";
import type { LobbyView } from "@/shared/realtime/contract";
import { loadRoom } from "./loadRoom";

/** Read model for the lobby screen. */
export class GetLobbyView {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly players: PlayerRepository,
    private readonly presence: PresenceTracker,
  ) {}

  /** For a player asking to see a lobby: only members may. */
  async execute(input: { code: string; requesterId: string }): Promise<LobbyView> {
    const room = await loadRoom(this.rooms, input.code);
    if (!room.findMember(input.requesterId)) throw notRoomMember();
    return this.build(room);
  }

  /**
   * For server-initiated broadcasts to sockets that were already authorised.
   * Returns null when the room no longer exists (its last player left).
   */
  async snapshot(code: string): Promise<LobbyView | null> {
    if (!isRoomCode(code)) return null;
    const room = await this.rooms.findByCode(parseRoomCode(code));
    return room ? this.build(room) : null;
  }

  private async build(room: Room): Promise<LobbyView> {
    const [players, online] = await Promise.all([
      this.players.findByIds(room.members.map((m) => m.playerId)),
      this.presence.onlinePlayerIds(room.code),
    ]);
    const names = new Map(players.map((p) => [p.id, p.displayName]));

    return {
      code: room.code,
      status: room.status,
      capacity: ROOM_CAPACITY,
      caseSlug: room.caseSlug,
      canStart: room.canStart,
      members: room.members.map((m) => ({
        playerId: m.playerId,
        displayName: names.get(m.playerId) ?? "Unknown",
        seat: m.seat,
        role: m.role,
        isReady: m.isReady,
        isOnline: online.has(m.playerId),
        isHost: m.playerId === room.hostId,
      })),
    };
  }
}
