import type { Player } from "@/domain/player/Player";
import type { Room, RoomMember } from "@/domain/room/Room";
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
  setMemberReady(roomId: string, playerId: string, isReady: boolean): Promise<void>;
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
