import { describe, expect, it } from "vitest";
import { validateCase } from "@/domain/case/CaseDefinition";
import { applyAction, createInitialState, projectFor, type GameState } from "@/domain/game/GameState";
import type { PlayerRole } from "@/domain/room/Room";
import { nightService47 as subject } from "./nightService47";

const play = (state: GameState, role: PlayerRole, action: Parameters<typeof applyAction>[3]) =>
  applyAction(subject, state, role, action);

const heldBy = (role: PlayerRole) => subject.evidence.filter((item) => item.heldBy === role);

/** Both briefings read, every item examined: the state a pair reach before answering anything. */
const fullyExplored = (): GameState => {
  let state = play(createInitialState({ A: "alice", B: "bob" }), "A", { type: "ACKNOWLEDGE_BRIEFING" });
  state = play(state, "B", { type: "ACKNOWLEDGE_BRIEFING" });
  for (const role of ["A", "B"] as const) {
    for (const item of heldBy(role)) {
      state = play(state, role, { type: "EXAMINE_EVIDENCE", evidenceId: item.id });
    }
  }
  return state;
};

describe("Night Service 47", () => {
  it("is valid content", () => {
    expect(validateCase(subject)).toEqual([]);
  });

  it("gives every puzzle something from each side, so neither player can finish alone", () => {
    for (const puzzle of subject.puzzles) {
      const sides = new Set(
        puzzle.requires.map((id) => subject.evidence.find((item) => item.id === id)?.heldBy),
      );
      expect(sides, puzzle.id).toEqual(new Set(["A", "B"]));
    }
  });

  it("can be played from the briefing to a closed case", () => {
    let state = fullyExplored();
    expect(projectFor(subject, state, "A").puzzles.every((p) => p.unlocked)).toBe(true);

    state = play(state, "A", { type: "SUBMIT_ANSWER", puzzleId: "who-was-in-7c", answer: "nia faro" });
    state = play(state, "B", { type: "SUBMIT_ANSWER", puzzleId: "where-they-left", answer: "Kestrel Siding" });
    expect(state.phase).toBe("INVESTIGATION");

    state = play(state, "A", { type: "SUBMIT_ANSWER", puzzleId: "who-opened-the-door", answer: " Teodor Vance " });
    expect(state.phase).toBe("RESOLVED");
    expect(projectFor(subject, state, "B").puzzles.every((p) => p.solved)).toBe(true);
  });

  it("locks each puzzle until both sides have looked", () => {
    // Only the Carriage Inspector has examined anything.
    let state = play(createInitialState({ A: "alice", B: "bob" }), "A", { type: "ACKNOWLEDGE_BRIEFING" });
    state = play(state, "B", { type: "ACKNOWLEDGE_BRIEFING" });
    for (const item of heldBy("A")) {
      state = play(state, "A", { type: "EXAMINE_EVIDENCE", evidenceId: item.id });
    }
    expect(projectFor(subject, state, "A").puzzles.some((p) => p.unlocked)).toBe(false);
  });

  it("never shows a player their partner's details or any accepted answer", () => {
    const state = fullyExplored();

    for (const [role, partner] of [
      ["A", "B"],
      ["B", "A"],
    ] as const) {
      const view = JSON.stringify(projectFor(subject, state, role));

      for (const item of heldBy(partner)) {
        for (const paragraph of item.details) {
          expect(view, `${role} saw ${partner}'s ${item.id}`).not.toContain(paragraph);
        }
      }
      for (const puzzle of subject.puzzles) {
        // "Faro" and "Vance" appear in evidence text that one side legitimately holds,
        // so only the exact accepted strings are forbidden.
        for (const answer of puzzle.check.kind === "exact-text" ? puzzle.check.accept : []) {
          expect(view.toLowerCase(), `${role} was handed the answer to ${puzzle.id}`).not.toContain(
            `"${answer.toLowerCase()}"`,
          );
        }
      }
    }
  });
});
