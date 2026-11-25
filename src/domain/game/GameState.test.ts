import { describe, expect, it } from "vitest";
import type { CaseDefinition } from "@/domain/case/CaseDefinition";
import { isDomainError } from "@/domain/errors";
import {
  applyAction,
  createInitialState,
  NOTEBOOK_MAX_LENGTH,
  projectFor,
  roleOf,
  type GameState,
} from "./GameState";

const testCase: CaseDefinition = {
  slug: "sample-case",
  version: 1,
  title: "Sample",
  synopsis: "A sample.",
  estimatedMinutes: 10,
  roles: {
    A: { name: "First", summary: "Goes first.", briefing: ["a"] },
    B: { name: "Second", summary: "Goes second.", briefing: ["b"] },
  },
  evidence: [
    { id: "a-one", heldBy: "A", name: "A's first", summary: "A-SUMMARY", details: ["A-DETAILS"] },
    { id: "a-two", heldBy: "A", name: "A's second", summary: "A2-SUMMARY", details: ["A2-DETAILS"] },
    { id: "b-one", heldBy: "B", name: "B's first", summary: "B-SUMMARY", details: ["B-DETAILS"] },
  ],
};

const initial = () => createInitialState({ A: "alice", B: "bob" });

/** Both players through the briefing, so evidence actions are allowed. */
const investigating = (): GameState => {
  const once = applyAction(testCase, initial(), "A", { type: "ACKNOWLEDGE_BRIEFING" });
  return applyAction(testCase, once, "B", { type: "ACKNOWLEDGE_BRIEFING" });
};

const act = (state: GameState, role: "A" | "B", action: Parameters<typeof applyAction>[3]) =>
  applyAction(testCase, state, role, action);

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err)) return err.code;
    throw err;
  }
  return null;
};

describe("createInitialState / roleOf", () => {
  it("starts in the briefing with nothing acknowledged or examined", () => {
    const state = initial();
    expect(state.phase).toBe("BRIEFING");
    expect(state.players.A).toEqual({
      playerId: "alice",
      briefingAcknowledged: false,
      notebook: "",
      examined: [],
      shared: [],
    });
  });

  it("maps players to roles and rejects strangers", () => {
    expect(roleOf(initial(), "bob")).toBe("B");
    expect(codeOf(() => roleOf(initial(), "mallory"))).toBe("NOT_ROOM_MEMBER");
  });
});

describe("applyAction", () => {
  it("never mutates the state it was given", () => {
    const state = investigating();
    const snapshot = structuredClone(state);
    act(state, "A", { type: "UPDATE_NOTEBOOK", text: "a clue" });
    act(state, "A", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" });
    expect(state).toEqual(snapshot);
  });

  it("moves to the investigation only once both players acknowledge the briefing", () => {
    const one = act(initial(), "A", { type: "ACKNOWLEDGE_BRIEFING" });
    expect(one.phase).toBe("BRIEFING");
    const both = act(one, "B", { type: "ACKNOWLEDGE_BRIEFING" });
    expect(both.phase).toBe("INVESTIGATION");
  });

  it("rejects acknowledging a briefing that is over", () => {
    expect(codeOf(() => act(investigating(), "A", { type: "ACKNOWLEDGE_BRIEFING" }))).toBe("INVALID_ACTION");
  });

  it("writes a notebook only for the acting role and enforces the length cap", () => {
    const state = act(initial(), "B", { type: "UPDATE_NOTEBOOK", text: "mine" });
    expect(state.players.B.notebook).toBe("mine");
    expect(state.players.A.notebook).toBe("");

    const tooLong = "x".repeat(NOTEBOOK_MAX_LENGTH + 1);
    expect(codeOf(() => act(state, "B", { type: "UPDATE_NOTEBOOK", text: tooLong }))).toBe("INVALID_ACTION");
  });
});

describe("evidence", () => {
  it("cannot be examined before the investigation starts", () => {
    expect(codeOf(() => act(initial(), "A", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" }))).toBe(
      "INVALID_ACTION",
    );
  });

  it("can only be examined by the role that holds it", () => {
    const state = investigating();
    expect(act(state, "A", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" }).players.A.examined).toEqual([
      "a-one",
    ]);
    expect(codeOf(() => act(state, "B", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" }))).toBe(
      "INVALID_ACTION",
    );
    expect(codeOf(() => act(state, "A", { type: "EXAMINE_EVIDENCE", evidenceId: "no-such-item" }))).toBe(
      "INVALID_ACTION",
    );
  });

  it("gives the same refusal for a partner's item as for one that does not exist", () => {
    const state = investigating();
    const partners = codeOf(() => act(state, "B", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" }));
    const missing = codeOf(() => act(state, "B", { type: "EXAMINE_EVIDENCE", evidenceId: "ghost" }));
    expect(partners).toBe(missing);
  });

  it("treats examining and sharing twice as no change", () => {
    let state = act(investigating(), "A", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" });
    expect(act(state, "A", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" })).toEqual(state);

    state = act(state, "A", { type: "SHARE_EVIDENCE", evidenceId: "a-one" });
    expect(state.players.A.shared).toEqual(["a-one"]);
    expect(act(state, "A", { type: "SHARE_EVIDENCE", evidenceId: "a-one" })).toEqual(state);
  });

  it("cannot be shared before it has been examined", () => {
    expect(codeOf(() => act(investigating(), "A", { type: "SHARE_EVIDENCE", evidenceId: "a-one" }))).toBe(
      "INVALID_ACTION",
    );
  });
});

describe("projectFor", () => {
  const played = (() => {
    let state = investigating();
    state = act(state, "A", { type: "UPDATE_NOTEBOOK", text: "ALICE-SECRET" });
    state = act(state, "A", { type: "EXAMINE_EVIDENCE", evidenceId: "a-one" });
    state = act(state, "A", { type: "EXAMINE_EVIDENCE", evidenceId: "a-two" });
    state = act(state, "A", { type: "SHARE_EVIDENCE", evidenceId: "a-one" });
    return act(state, "B", { type: "EXAMINE_EVIDENCE", evidenceId: "b-one" });
  })();

  it("lists a player's own items, with content only once examined", () => {
    const fresh = projectFor(testCase, investigating(), "A");
    expect(fresh.evidence.yours).toEqual([
      { id: "a-one", name: "A's first", examined: false, shared: false, summary: null, details: null },
      { id: "a-two", name: "A's second", examined: false, shared: false, summary: null, details: null },
    ]);

    const mine = projectFor(testCase, played, "A").evidence.yours;
    expect(mine[0]).toMatchObject({ examined: true, shared: true, summary: "A-SUMMARY", details: ["A-DETAILS"] });
    expect(mine[1]).toMatchObject({ examined: true, shared: false });
  });

  it("passes on a shared item's summary but never its details", () => {
    const forBob = projectFor(testCase, played, "B");
    expect(forBob.evidence.fromPartner).toEqual([{ id: "a-one", name: "A's first", summary: "A-SUMMARY" }]);
    expect(JSON.stringify(forBob)).not.toContain("A-DETAILS");
  });

  it("hides unshared items, the partner's notebook and everyone's player id", () => {
    const forBob = JSON.stringify(projectFor(testCase, played, "B"));
    const forAlice = JSON.stringify(projectFor(testCase, played, "A"));

    expect(forBob).not.toContain("A2-SUMMARY");
    expect(forBob).not.toContain("A's second");
    expect(forBob).not.toContain("ALICE-SECRET");
    expect(forAlice).not.toContain("B-SUMMARY");
    expect(forAlice).not.toContain("B-DETAILS");
    expect(forAlice + forBob).not.toMatch(/alice|bob/);
  });

  it("tells a player how many items their partner has handed over", () => {
    expect(projectFor(testCase, played, "B").partner.sharedCount).toBe(1);
    expect(projectFor(testCase, played, "A").partner.sharedCount).toBe(0);
  });

  it("ignores a shared id that the case no longer defines", () => {
    const edited: CaseDefinition = { ...testCase, evidence: testCase.evidence.filter((e) => e.id !== "a-one") };
    expect(projectFor(edited, played, "B").evidence.fromPartner).toEqual([]);
  });
});
