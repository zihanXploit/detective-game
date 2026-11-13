import { describe, expect, it } from "vitest";
import { isDomainError } from "@/domain/errors";
import { applyAction, createInitialState, NOTEBOOK_MAX_LENGTH, projectFor, roleOf } from "./GameState";

const initial = () => createInitialState({ A: "alice", B: "bob" });

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
  it("starts in the briefing with nothing acknowledged", () => {
    const state = initial();
    expect(state.phase).toBe("BRIEFING");
    expect(state.players.A).toEqual({ playerId: "alice", briefingAcknowledged: false, notebook: "" });
  });

  it("maps players to roles and rejects strangers", () => {
    expect(roleOf(initial(), "bob")).toBe("B");
    expect(codeOf(() => roleOf(initial(), "mallory"))).toBe("NOT_ROOM_MEMBER");
  });
});

describe("applyAction", () => {
  it("never mutates the state it was given", () => {
    const state = initial();
    const snapshot = structuredClone(state);
    applyAction(state, "A", { type: "UPDATE_NOTEBOOK", text: "a clue" });
    applyAction(state, "A", { type: "ACKNOWLEDGE_BRIEFING" });
    expect(state).toEqual(snapshot);
  });

  it("moves to the investigation only once both players acknowledge the briefing", () => {
    const one = applyAction(initial(), "A", { type: "ACKNOWLEDGE_BRIEFING" });
    expect(one.phase).toBe("BRIEFING");
    expect(one.players.B.briefingAcknowledged).toBe(false);

    const both = applyAction(one, "B", { type: "ACKNOWLEDGE_BRIEFING" });
    expect(both.phase).toBe("INVESTIGATION");
  });

  it("rejects acknowledging a briefing that is over", () => {
    let state = applyAction(initial(), "A", { type: "ACKNOWLEDGE_BRIEFING" });
    state = applyAction(state, "B", { type: "ACKNOWLEDGE_BRIEFING" });
    expect(codeOf(() => applyAction(state, "A", { type: "ACKNOWLEDGE_BRIEFING" }))).toBe("INVALID_ACTION");
  });

  it("writes a notebook only for the acting role and enforces the length cap", () => {
    const state = applyAction(initial(), "B", { type: "UPDATE_NOTEBOOK", text: "mine" });
    expect(state.players.B.notebook).toBe("mine");
    expect(state.players.A.notebook).toBe("");

    const tooLong = "x".repeat(NOTEBOOK_MAX_LENGTH + 1);
    expect(codeOf(() => applyAction(state, "B", { type: "UPDATE_NOTEBOOK", text: tooLong }))).toBe("INVALID_ACTION");
  });
});

describe("projectFor", () => {
  const state = (() => {
    let s = applyAction(initial(), "A", { type: "UPDATE_NOTEBOOK", text: "ALICE-SECRET" });
    s = applyAction(s, "B", { type: "UPDATE_NOTEBOOK", text: "BOB-SECRET" });
    return applyAction(s, "B", { type: "ACKNOWLEDGE_BRIEFING" });
  })();

  it("shows a player their own side in full", () => {
    const view = projectFor(state, "A");
    expect(view.you).toEqual({ role: "A", briefingAcknowledged: false, notebook: "ALICE-SECRET" });
    expect(view.partner).toEqual({ role: "B", briefingAcknowledged: true });
  });

  it("never leaks the partner's private data or anyone's player id", () => {
    const forAlice = JSON.stringify(projectFor(state, "A"));
    const forBob = JSON.stringify(projectFor(state, "B"));
    expect(forAlice).not.toContain("BOB-SECRET");
    expect(forBob).not.toContain("ALICE-SECRET");
    expect(forAlice + forBob).not.toMatch(/alice|bob/);
  });
});
