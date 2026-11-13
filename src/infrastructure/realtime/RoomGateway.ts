import type { PresenceTracker } from "@/application/ports";
import type { GetLobbyView } from "@/application/use-cases/GetLobbyView";
import type { RoomCode } from "@/domain/room/RoomCode";
import type {
  GameStateEnvelope,
  PlayerGameView,
  RoomStateEnvelope,
  SocketData,
} from "@/shared/realtime/contract";
import type { GameServer } from "./types";

/** Everyone seated in the room. Only for data both players may see. */
const roomChannel = (code: string) => `room:${code}`;
/** One player's connections (all their tabs) in one room. The route for anything private. */
const playerChannel = (code: string, playerId: string) => `room:${code}:player:${playerId}`;

/** The subset of a socket this class needs; satisfied by local and remote sockets alike. */
interface Attachable {
  id: string;
  data: Partial<SocketData>;
  join(channel: string): unknown;
  leave(channel: string): unknown;
}

/**
 * The single place that knows how rooms map onto Socket.IO channels.
 * Handlers say who should hear something; they never name a channel themselves,
 * so there is one spot to audit for "could this reach the wrong player?".
 */
export class RoomGateway {
  private lastSeq = 0;

  constructor(
    private readonly io: GameServer,
    private readonly presence: PresenceTracker,
    private readonly lobbyView: GetLobbyView,
  ) {}

  async attach(socket: Attachable & { data: SocketData }, code: RoomCode): Promise<void> {
    await socket.join(roomChannel(code));
    await socket.join(playerChannel(code, socket.data.playerId));
    await this.presence.connect(socket.id, code, socket.data.playerId);
    socket.data.roomCode = code;
  }

  /** Removes one connection from its room, leaving membership untouched. Returns the room it was in. */
  async detach(socket: Attachable): Promise<RoomCode | null> {
    const code = await this.presence.disconnect(socket.id);
    socket.data.roomCode = undefined;
    if (code && socket.data.playerId) {
      await socket.leave(roomChannel(code));
      await socket.leave(playerChannel(code, socket.data.playerId));
    }
    return code;
  }

  /**
   * Sends the current room state to everyone in the room.
   * Returns null when the room no longer exists (its last player left).
   */
  async publishState(code: string): Promise<RoomStateEnvelope | null> {
    const view = await this.lobbyView.snapshot(code);
    if (!view) return null;

    const state: RoomStateEnvelope = { seq: ++this.lastSeq, view };
    this.io.to(roomChannel(code)).emit("lobby:state", state);
    return state;
  }

  /** Stamps one player's game view for the ack of their own request. */
  stampGameView(view: PlayerGameView): GameStateEnvelope {
    return { seq: ++this.lastSeq, view };
  }

  /** Delivers a game view to its owner only, on every tab they have open in this room. */
  sendGameView(code: string, playerId: string, view: PlayerGameView): void {
    this.io.to(playerChannel(code, playerId)).emit("game:state", this.stampGameView(view));
  }

  /** Tells every tab a player has open on this room that their seat is gone, then cuts them off. */
  async evict(code: string, playerId: string): Promise<void> {
    const channel = playerChannel(code, playerId);
    this.io.to(channel).emit("lobby:evicted", { code });
    const sockets = await this.io.in(channel).fetchSockets();
    await Promise.all(sockets.map((socket) => this.detach(socket)));
  }
}
