/**
 * The wire contract between browser and server. Imported by both sides so
 * event names and payload shapes are checked at compile time.
 * Runtime validation of client payloads lives in ./schemas.
 */

export type RoomStatusView = "LOBBY" | "IN_PROGRESS" | "COMPLETED";
export type PlayerRoleView = "A" | "B";

export interface LobbyMemberView {
  playerId: string;
  displayName: string;
  seat: number;
  role: PlayerRoleView | null;
  isReady: boolean;
  isOnline: boolean;
  isHost: boolean;
}

export interface LobbyView {
  code: string;
  status: RoomStatusView;
  capacity: number;
  canStart: boolean;
  members: LobbyMemberView[];
}

/**
 * A full snapshot of room state stamped with a server sequence number.
 * Sequence numbers only ever grow within one connection, so a client can drop
 * anything older than what it already shows. They restart when the server
 * does, which is why clients reset their baseline on every (re)connect.
 */
export interface RoomStateEnvelope {
  seq: number;
  view: LobbyView;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type Ack<T> = (result: Result<T>) => void;

type NoPayload = Record<string, never>;

export interface ClientToServerEvents {
  /** Also the resync request: the ack always carries the latest snapshot. */
  "lobby:join": (payload: { code: string }, ack: Ack<RoomStateEnvelope>) => void;
  "lobby:chooseRole": (payload: { role: PlayerRoleView | null }, ack: Ack<null>) => void;
  "lobby:setReady": (payload: { isReady: boolean }, ack: Ack<null>) => void;
  "lobby:start": (payload: NoPayload, ack: Ack<null>) => void;
  "lobby:leave": (payload: NoPayload, ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  /** Sent to everyone in the room. Never carries anything one player must not see. */
  "lobby:state": (state: RoomStateEnvelope) => void;
  /** Sent privately to one player: their seat in this room is gone. */
  "lobby:evicted": (payload: { code: string }) => void;
}

export interface SocketData {
  playerId: string;
  roomCode?: string;
}
