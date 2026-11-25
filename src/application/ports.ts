import type { CaseDefinition, CaseSummary } from "@/domain/case/CaseDefinition";
import type { GameState } from "@/domain/game/GameState";
import type { Player } from "@/domain/player/Player";
import type { Room, RoomMember, RoomStatus } from "@/domain/room/Room";
import type { RoomCode } from "@/domain/room/RoomCode";

export interface PlayerRepository {
  findById(id: string): Promise<Player | null>;
  findByIds(ids: readonly string[]): Promise<Player[]>;
  create(displayName: string): Promise<Player>;
  rename(id: string, displayName: string): Promise<Player>;
}

export interface RoomRepository {
  /** Persists a new room with its host. Throws ROOM_CODE_TAKEN if the code collides. */
  create(room: Room): Promise<void>;
  findByCode(code: RoomCode): Promise<Room | null>;
  /** Throws ROOM_FULL if another player claimed the seat first. */
  addMember(roomId: string, member: RoomMember): Promise<void>;
  /** Persists a member's role and readiness. Throws ROLE_TAKEN if the partner claimed the role first. */
  updateMember(roomId: string, member: RoomMember): Promise<void>;
  /**
   * Persists a departure from `room` (already applied in memory): removes the member and
   * records the possibly new host, or deletes the room when nobody is left.
   */
  removeMember(room: Room, playerId: string): Promise<void>;
  /** Moves the room out of the lobby. Returns false if it had already left it. */
  markStarted(roomId: string): Promise<boolean>;
  /** Persists the room's chosen case together with every member's readiness. */
  saveCaseSelection(room: Room): Promise<void>;
  /** Moves the room to COMPLETED. Safe to call more than once. */
  markCompleted(roomId: string): Promise<void>;
}

/** The cases available to play. Synchronous: case content ships with the app. */
export interface CaseCatalog {
  list(): readonly CaseSummary[];
  find(slug: string): CaseDefinition | null;
}

/** Which case a session is playing, and the version of its content the state was written against. */
export interface CaseRef {
  slug: string;
  version: number;
}

export interface StoredGameSession {
  id: string;
  caseRef: CaseRef;
  state: GameState;
  /** Bumped on every save; pass it back to `save` to detect a concurrent writer. */
  version: number;
  completedAt: Date | null;
}

export interface GameSessionRepository {
  /**
   * The room's game, finished or not. It must not filter by status: a finished
   * case is still the one a pair come back to, and skipping it would silently
   * start them a second game.
   */
  findCurrentByRoom(roomId: string): Promise<StoredGameSession | null>;
  /** Idempotent per room and case: returns the existing session if one was created concurrently. */
  create(roomId: string, caseRef: CaseRef, state: GameState): Promise<StoredGameSession>;
  /** Writes only if the stored version still equals `expectedVersion`. Returns false otherwise. */
  save(id: string, state: GameState, expectedVersion: number): Promise<boolean>;
  /** Marks the case closed. Idempotent: a session already closed keeps its first timestamp. */
  complete(id: string): Promise<void>;
  /** Records which version of the case's content this save is now being played against. */
  recordCaseVersion(id: string, version: number): Promise<void>;
}

/** One line in a player's list of rooms to come back to. */
export interface RoomListEntry {
  code: string;
  status: RoomStatus;
  caseSlug: string | null;
  /** The other player's name, if a seat is taken. */
  partnerName: string | null;
  lastActiveAt: Date;
}

/** A read model: the rooms one player can return to, newest first. */
export interface RoomDirectory {
  listForPlayer(playerId: string, limit: number): Promise<RoomListEntry[]>;
}

export interface RoomCodeGenerator {
  generate(): RoomCode;
}

export interface IdGenerator {
  next(): string;
}

export type Clock = () => Date;

/**
 * Tracks which players currently have a live connection to a room.
 * Async so the in-memory implementation can be swapped for Redis when
 * the realtime layer runs on more than one node.
 */
export interface PresenceTracker {
  connect(connectionId: string, roomCode: RoomCode, playerId: string): Promise<void>;
  /** Returns the room the connection was in, if any. */
  disconnect(connectionId: string): Promise<RoomCode | null>;
  onlinePlayerIds(roomCode: RoomCode): Promise<ReadonlySet<string>>;
}
