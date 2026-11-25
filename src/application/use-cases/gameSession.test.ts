import { describe, expect, it } from "vitest";
import type {
  CaseCatalog,
  CaseRef,
  GameSessionRepository,
  RoomRepository,
  StoredGameSession,
} from "@/application/ports";
import type { CaseDefinition } from "@/domain/case/CaseDefinition";
import { isDomainError } from "@/domain/errors";
import { createInitialState, type GameState } from "@/domain/game/GameState";
import { Room, type RoomProps } from "@/domain/room/Room";
import { parseRoomCode } from "@/domain/room/RoomCode";
import { loadGame, type GameDeps } from "./gameSession";
import { PerformGameAction } from "./PerformGameAction";

const now = new Date("2026-01-01T00:00:00Z");

const caseAt = (version: number): CaseDefinition => ({
  slug: "sample-case",
  version,
  title: "Sample",
  synopsis: "A sample.",
  estimatedMinutes: 5,
  roles: {
    A: { name: "First", summary: "Goes first.", briefing: ["a"] },
    B: { name: "Second", summary: "Goes second.", briefing: ["b"] },
  },
  evidence: [
    { id: "a-one", heldBy: "A", name: "A's item", summary: "A summary.", details: ["A details."] },
    { id: "b-one", heldBy: "B", name: "B's item", summary: "B summary.", details: ["B details."] },
  ],
  // No requirements, so it is open from the start and one answer closes the case.
  puzzles: [
    {
      id: "only-question",
      name: "Only question",
      prompt: "Answer it.",
      requires: [],
      check: { kind: "exact-text", accept: ["yes"] },
      hints: [],
    },
  ],
});

const roomProps = (): RoomProps => ({
  id: "room-1",
  code: parseRoomCode("ABCDEF"),
  status: "IN_PROGRESS",
  hostId: "alice",
  caseSlug: "sample-case",
  members: [
    { playerId: "alice", seat: 0, role: "A", isReady: true, joinedAt: now },
    { playerId: "bob", seat: 1, role: "B", isReady: true, joinedAt: now },
  ],
});

const startedRoom = () => new Room(roomProps());

class FakeRooms implements RoomRepository {
  completed: string[] = [];
  constructor(private readonly room: Room | null = startedRoom()) {}
  async findByCode() {
    return this.room;
  }
  async markCompleted(roomId: string) {
    this.completed.push(roomId);
  }
  async create() {}
  async addMember() {}
  async updateMember() {}
  async removeMember() {}
  async saveCaseSelection() {}
  async markStarted() {
    return true;
  }
}

class FakeSessions implements GameSessionRepository {
  created = 0;
  completed: string[] = [];
  versionsRecorded: Array<{ id: string; version: number }> = [];
  saved: GameState[] = [];

  constructor(private current: StoredGameSession | null = null) {}

  async findCurrentByRoom() {
    return this.current;
  }
  async create(_roomId: string, caseRef: CaseRef, state: GameState) {
    this.created += 1;
    this.current = { id: "session-new", caseRef, state, version: 0, completedAt: null };
    return this.current;
  }
  async save(_id: string, state: GameState) {
    this.saved.push(state);
    return true;
  }
  async complete(id: string) {
    this.completed.push(id);
  }
  async recordCaseVersion(id: string, version: number) {
    this.versionsRecorded.push({ id, version });
  }
}

const catalogOf = (definition: CaseDefinition): CaseCatalog => ({
  list: () => [],
  find: (slug) => (slug === definition.slug ? definition : null),
});

const storedSession = (over: Partial<StoredGameSession> = {}): StoredGameSession => ({
  id: "session-1",
  caseRef: { slug: "sample-case", version: 1 },
  state: createInitialState({ A: "alice", B: "bob" }),
  version: 3,
  completedAt: null,
  ...over,
});

const deps = (sessions: FakeSessions, rooms = new FakeRooms(), version = 1): GameDeps & { rooms: FakeRooms } => ({
  rooms,
  sessions,
  cases: catalogOf(caseAt(version)),
});

const codeOf = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (err) {
    if (isDomainError(err)) return err.code;
    throw err;
  }
  return null;
};

describe("loadGame", () => {
  it("returns a finished game instead of quietly starting a second one", async () => {
    const sessions = new FakeSessions(storedSession({ completedAt: now }));
    const loaded = await loadGame(deps(sessions), { code: "ABCDEF", playerId: "alice" });

    expect(loaded.session.id).toBe("session-1");
    expect(sessions.created).toBe(0);
  });

  it("still loads the game of a room whose case is closed", async () => {
    const closedRoom = new FakeRooms(new Room({ ...roomProps(), status: "COMPLETED" }));
    const sessions = new FakeSessions(storedSession({ completedAt: now }));

    const loaded = await loadGame(deps(sessions, closedRoom), { code: "ABCDEF", playerId: "alice" });
    expect(loaded.session.id).toBe("session-1");
    expect(sessions.created).toBe(0);
  });

  it("opens a session for a started room that somehow has none", async () => {
    const sessions = new FakeSessions(null);
    const loaded = await loadGame(deps(sessions), { code: "ABCDEF", playerId: "bob" });

    expect(sessions.created).toBe(1);
    expect(loaded.role).toBe("B");
  });

  it("records the new version when the case has been edited since the game began", async () => {
    const sessions = new FakeSessions(storedSession({ caseRef: { slug: "sample-case", version: 1 } }));
    const loaded = await loadGame(deps(sessions, new FakeRooms(), 4), { code: "ABCDEF", playerId: "alice" });

    expect(sessions.versionsRecorded).toEqual([{ id: "session-1", version: 4 }]);
    expect(loaded.session.caseRef.version).toBe(4);
  });

  it("does not write when the case has not changed", async () => {
    const sessions = new FakeSessions(storedSession());
    await loadGame(deps(sessions), { code: "ABCDEF", playerId: "alice" });
    expect(sessions.versionsRecorded).toEqual([]);
  });

  it("refuses a player who is not in the room, and a room still in its lobby", async () => {
    const sessions = new FakeSessions(storedSession());
    expect(await codeOf(() => loadGame(deps(sessions), { code: "ABCDEF", playerId: "mallory" }))).toBe(
      "NOT_ROOM_MEMBER",
    );

    const lobbyRoom = new Room({ ...roomProps(), status: "LOBBY" });
    const inLobby = deps(new FakeSessions(storedSession()), new FakeRooms(lobbyRoom));
    expect(await codeOf(() => loadGame(inLobby, { code: "ABCDEF", playerId: "alice" }))).toBe("GAME_NOT_STARTED");
  });
});

describe("PerformGameAction", () => {
  it("closes the case and the room once the last question is answered", async () => {
    const sessions = new FakeSessions(storedSession({ state: investigating() }));
    const rooms = new FakeRooms();
    await new PerformGameAction(deps(sessions, rooms)).execute({
      code: "ABCDEF",
      playerId: "alice",
      action: { type: "SUBMIT_ANSWER", puzzleId: "only-question", answer: "yes" },
    });

    expect(sessions.saved.at(-1)?.phase).toBe("RESOLVED");
    expect(sessions.completed).toEqual(["session-1"]);
    expect(rooms.completed).toEqual(["room-1"]);
  });

  it("does not close anything on an action that leaves the case open", async () => {
    const sessions = new FakeSessions(storedSession({ state: investigating() }));
    const rooms = new FakeRooms();
    await new PerformGameAction(deps(sessions, rooms)).execute({
      code: "ABCDEF",
      playerId: "alice",
      action: { type: "SUBMIT_ANSWER", puzzleId: "only-question", answer: "no" },
    });

    expect(sessions.completed).toEqual([]);
    expect(rooms.completed).toEqual([]);
  });
});

/** A state with both briefings read, so game actions are allowed. */
function investigating(): GameState {
  const state = createInitialState({ A: "alice", B: "bob" });
  return {
    ...state,
    phase: "INVESTIGATION",
    players: {
      A: { ...state.players.A, briefingAcknowledged: true },
      B: { ...state.players.B, briefingAcknowledged: true },
    },
  };
}
