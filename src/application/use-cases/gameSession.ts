import type {
  CaseCatalog,
  GameSessionRepository,
  RoomRepository,
  StoredGameSession,
} from "@/application/ports";
import { caseNotFound, gameNotStarted, notRoomMember } from "@/domain/errors";
import { caseFileFor, type CaseDefinition } from "@/domain/case/CaseDefinition";
import { createInitialState, projectFor, roleOf, type GameState } from "@/domain/game/GameState";
import type { PlayerRole, Room } from "@/domain/room/Room";
import type { PlayerGameView } from "@/shared/realtime/contract";
import { loadRoom } from "./loadRoom";

export interface GameDeps {
  rooms: RoomRepository;
  sessions: GameSessionRepository;
  cases: CaseCatalog;
}

/** Creates the session for a started room from its chosen case and the roles picked in the lobby. */
export async function openSession(
  { sessions, cases }: Pick<GameDeps, "sessions" | "cases">,
  room: Room,
): Promise<StoredGameSession> {
  const definition = room.caseSlug ? cases.find(room.caseSlug) : null;
  if (!definition) throw caseNotFound();

  const byRole = new Map(room.members.map((m) => [m.role, m.playerId]));
  const a = byRole.get("A");
  const b = byRole.get("B");
  if (!a || !b) throw gameNotStarted();

  return sessions.create(
    room.id,
    { slug: definition.slug, version: definition.version },
    createInitialState({ A: a, B: b }),
  );
}

export interface LoadedGame {
  session: StoredGameSession;
  definition: CaseDefinition;
  role: PlayerRole;
}

/** Shared first step of every game use case: the session, its case, and the caller's role in it. */
export async function loadGame(deps: GameDeps, input: { code: string; playerId: string }): Promise<LoadedGame> {
  const room = await loadRoom(deps.rooms, input.code);
  if (!room.findMember(input.playerId)) throw notRoomMember();
  if (room.status !== "IN_PROGRESS") throw gameNotStarted();

  // A started room should always have a session. If the server stopped between
  // the two writes, open it now rather than strand the room.
  const session = (await deps.sessions.findActiveByRoom(room.id)) ?? (await openSession(deps, room));

  // A case can disappear from the app while saves of it still exist.
  const definition = deps.cases.find(session.caseRef.slug);
  if (!definition) throw caseNotFound();

  return { session, definition, role: roleOf(session.state, input.playerId) };
}

/** Everything one player may see: their side of the state plus their side of the case. */
export function buildPlayerView(definition: CaseDefinition, state: GameState, role: PlayerRole): PlayerGameView {
  return { ...projectFor(definition, state, role), caseFile: caseFileFor(definition, role) };
}
