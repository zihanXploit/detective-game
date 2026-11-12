import type { CaseRef, GameSessionRepository, RoomRepository, StoredGameSession } from "@/application/ports";
import { gameNotStarted, notRoomMember } from "@/domain/errors";
import { createInitialState, roleOf } from "@/domain/game/GameState";
import type { PlayerRole, Room } from "@/domain/room/Room";
import { loadRoom } from "./loadRoom";

/**
 * Stands in until the case system exists: sessions need a case reference to be
 * stored, and there are no cases to choose from yet.
 */
export const PLACEHOLDER_CASE: CaseRef = { slug: "placeholder", version: 1 };

/** Creates the session for a started room from the roles its players chose in the lobby. */
export async function openSession(sessions: GameSessionRepository, room: Room): Promise<StoredGameSession> {
  const byRole = new Map(room.members.map((m) => [m.role, m.playerId]));
  const a = byRole.get("A");
  const b = byRole.get("B");
  if (!a || !b) throw gameNotStarted();
  return sessions.create(room.id, PLACEHOLDER_CASE, createInitialState({ A: a, B: b }));
}

export interface LoadedGame {
  room: Room;
  session: StoredGameSession;
  role: PlayerRole;
}

/** Shared first step of every game use case: the room, its session, and the caller's role in it. */
export async function loadGame(
  rooms: RoomRepository,
  sessions: GameSessionRepository,
  input: { code: string; playerId: string },
): Promise<LoadedGame> {
  const room = await loadRoom(rooms, input.code);
  if (!room.findMember(input.playerId)) throw notRoomMember();
  if (room.status !== "IN_PROGRESS") throw gameNotStarted();

  // A started room should always have a session. If one is missing (the server stopped
  // between the two writes, or the room predates sessions), open it now rather than strand the room.
  const session = (await sessions.findActiveByRoom(room.id)) ?? (await openSession(sessions, room));
  return { room, session, role: roleOf(session.state, input.playerId) };
}
