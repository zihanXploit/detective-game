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

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type Ack<T> = (result: Result<T>) => void;

type NoPayload = Record<string, never>;

export interface ClientToServerEvents {
  "lobby:join": (payload: { code: string }, ack: Ack<LobbyView>) => void;
  "lobby:chooseRole": (payload: { role: PlayerRoleView | null }, ack: Ack<null>) => void;
  "lobby:setReady": (payload: { isReady: boolean }, ack: Ack<null>) => void;
  "lobby:start": (payload: NoPayload, ack: Ack<null>) => void;
  "lobby:leave": (payload: NoPayload, ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  "lobby:state": (view: LobbyView) => void;
}

export interface SocketData {
  playerId: string;
  roomCode?: string;
}
