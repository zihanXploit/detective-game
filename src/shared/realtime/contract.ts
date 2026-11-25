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
  /** The case the host has chosen, if any. */
  caseSlug: string | null;
  canStart: boolean;
  members: LobbyMemberView[];
}

/** What anyone may know about a case before playing it. Never includes briefing text. */
export interface CaseSummaryView {
  slug: string;
  title: string;
  synopsis: string;
  estimatedMinutes: number;
  roleNames: Record<PlayerRoleView, string>;
  roleSummaries: Record<PlayerRoleView, string>;
}

/** One role's slice of the case being played. */
export interface CaseFileView {
  title: string;
  yourRole: { name: string; summary: string; briefing: readonly string[] };
  partnerRoleName: string;
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

export type GamePhaseView = "BRIEFING" | "INVESTIGATION" | "RESOLVED";

/** One of the player's own items. Content arrives only once they examine it. */
export interface OwnEvidenceItemView {
  id: string;
  name: string;
  examined: boolean;
  shared: boolean;
  summary: string | null;
  details: readonly string[] | null;
}

/** An item the partner handed over. It has no details: those have to be said out loud. */
export interface SharedEvidenceItemView {
  id: string;
  name: string;
  summary: string;
}

/** A puzzle as a player sees it. Nothing here is derived from the solution. */
export interface PuzzleItemView {
  id: string;
  name: string;
  prompt: string;
  unlocked: boolean;
  solved: boolean;
  attempts: number;
  hints: readonly string[];
  hintsRemaining: number;
  solvedNote: string | null;
  /** Why it is still shut: your own missing items by name, your partner's as a count. */
  blockedBy: { yours: readonly string[]; partnerItems: number } | null;
}

/** One player's view of the game. Built per player on the server; never broadcast to the room. */
export interface PlayerGameView {
  phase: GamePhaseView;
  you: { role: PlayerRoleView; briefingAcknowledged: boolean; notebook: string };
  partner: { role: PlayerRoleView; briefingAcknowledged: boolean; sharedCount: number };
  evidence: { yours: OwnEvidenceItemView[]; fromPartner: SharedEvidenceItemView[] };
  puzzles: PuzzleItemView[];
  caseFile: CaseFileView;
}

export interface GameStateEnvelope {
  seq: number;
  view: PlayerGameView;
}

export type GameActionPayload =
  | { type: "ACKNOWLEDGE_BRIEFING" }
  | { type: "UPDATE_NOTEBOOK"; text: string }
  | { type: "EXAMINE_EVIDENCE"; evidenceId: string }
  | { type: "SHARE_EVIDENCE"; evidenceId: string }
  | { type: "SUBMIT_ANSWER"; puzzleId: string; answer: string }
  | { type: "REVEAL_HINT"; puzzleId: string };

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type Ack<T> = (result: Result<T>) => void;

type NoPayload = Record<string, never>;

export interface ClientToServerEvents {
  /** Also the resync request: the ack always carries the latest snapshot. */
  "lobby:join": (payload: { code: string }, ack: Ack<RoomStateEnvelope>) => void;
  /** Host only. */
  "lobby:selectCase": (payload: { caseSlug: string }, ack: Ack<null>) => void;
  "lobby:chooseRole": (payload: { role: PlayerRoleView | null }, ack: Ack<null>) => void;
  "lobby:setReady": (payload: { isReady: boolean }, ack: Ack<null>) => void;
  "lobby:start": (payload: NoPayload, ack: Ack<null>) => void;
  "lobby:leave": (payload: NoPayload, ack: Ack<null>) => void;
  /** Fetches the caller's own view of the game; used on entering the game and after reconnecting. */
  "game:sync": (payload: NoPayload, ack: Ack<GameStateEnvelope>) => void;
  "game:act": (payload: GameActionPayload, ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  /** Sent to everyone in the room. Never carries anything one player must not see. */
  "lobby:state": (state: RoomStateEnvelope) => void;
  /** Sent privately to one player: their seat in this room is gone. */
  "lobby:evicted": (payload: { code: string }) => void;
  /** Sent privately to one player: their own view of the game after any change. */
  "game:state": (state: GameStateEnvelope) => void;
}

export interface SocketData {
  playerId: string;
  roomCode?: string;
}
