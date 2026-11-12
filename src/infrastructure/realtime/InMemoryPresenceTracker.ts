import type { PresenceTracker } from "@/application/ports";
import type { RoomCode } from "@/domain/room/RoomCode";

/** Keyed by connection so a player with two tabs open stays online until both close. */
export class InMemoryPresenceTracker implements PresenceTracker {
  private readonly connections = new Map<string, { roomCode: RoomCode; playerId: string }>();

  async connect(connectionId: string, roomCode: RoomCode, playerId: string): Promise<void> {
    this.connections.set(connectionId, { roomCode, playerId });
  }

  async disconnect(connectionId: string): Promise<RoomCode | null> {
    const entry = this.connections.get(connectionId);
    this.connections.delete(connectionId);
    return entry?.roomCode ?? null;
  }

  async onlinePlayerIds(roomCode: RoomCode): Promise<ReadonlySet<string>> {
    const online = new Set<string>();
    for (const entry of this.connections.values()) {
      if (entry.roomCode === roomCode) online.add(entry.playerId);
    }
    return online;
  }
}
