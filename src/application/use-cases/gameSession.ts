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
  roomId: string;
  session: StoredGameSession;
  definition: CaseDefinition;
  role: PlayerRole;
}

/** Shared first step of every game use case: the session, its case, and the caller's role in it. */
export async function loadGame(deps: GameDeps, input: { code: string; playerId: string }): Promise<LoadedGame> {
  const room = await loadRoom(deps.rooms, input.code);
  if (!room.findMember(input.playerId)) throw notRoomMember();
  // A closed case is still a game its players may open: only a room that has
  // never started has nothing to show.
  if (room.status === "LOBBY") throw gameNotStarted();

  // A started room should always have a session. If the server stopped between
  // the two writes, open it now rather than strand the room.
  const session = (await deps.sessions.findCurrentByRoom(room.id)) ?? (await openSession(deps, room));

  // A case can disappear from the app while saves of it still exist.
  const definition = deps.cases.find(session.caseRef.slug);
  if (!definition) throw caseNotFound();

  // The case may have been edited since this game began. The engine copes with
  // content that has moved on, so record what the save is now running against
  // rather than refuse to load it.
  const current =
    definition.version === session.caseRef.version
      ? session
      : { ...session, caseRef: { slug: definition.slug, version: definition.version } };
  if (current !== session) await deps.sessions.recordCaseVersion(session.id, definition.version);

  return { roomId: room.id, session: current, definition, role: roleOf(session.state, input.playerId) };
}

/** Everything one player may see: their side of the state plus their side of the case. */
export function buildPlayerView(definition: CaseDefinition, state: GameState, role: PlayerRole): PlayerGameView {
  return { ...projectFor(definition, state, role), caseFile: caseFileFor(definition, role) };
}
