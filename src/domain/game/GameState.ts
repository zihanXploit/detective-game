import {
  evidenceHeldBy,
  findEvidence,
  findPuzzle,
  type CaseDefinition,
} from "@/domain/case/CaseDefinition";
import { invalidAction, notRoomMember } from "@/domain/errors";
import { isAnswerCorrect } from "@/domain/puzzle/checkers";
import type { PuzzleDefinition } from "@/domain/puzzle/PuzzleDefinition";
import type { PlayerRole } from "@/domain/room/Room";

/**
 * The game engine's core: plain data plus pure functions.
 *
 *   applyAction(case, state, role, action) -> next state   (the only way state changes)
 *   projectFor(case, state, role)          -> what that player may see
 *
 * The case definition is passed in rather than copied into the state, so saves
 * stay small and a corrected case reaches games already in progress.
 *
 * No I/O, no clock, no randomness, so every rule is unit-testable and a saved
 * state can always be replayed.
 */

export type GamePhase = "BRIEFING" | "INVESTIGATION" | "RESOLVED";

export const NOTEBOOK_MAX_LENGTH = 4000;
export const ANSWER_MAX_LENGTH = 200;

/** Everything the server knows about one side of the case. Never sent to the other side as-is. */
export interface PlayerGameState {
  playerId: string;
  briefingAcknowledged: boolean;
  /** Private scratch space. The partner must never receive it. */
  notebook: string;
  /** Ids of this role's own evidence that they have examined. */
  examined: string[];
  /** Ids this role has handed to their partner. Always a subset of `examined`. */
  shared: string[];
}

/** Progress on one puzzle. Shared: both players see the same numbers. */
export interface PuzzleProgress {
  attempts: number;
  solved: boolean;
  hintsRevealed: number;
}

export interface GameState {
  phase: GamePhase;
  players: Record<PlayerRole, PlayerGameState>;
  /** Keyed by puzzle id, and sparse: an untouched puzzle has no entry. */
  puzzles: Record<string, PuzzleProgress>;
}

export type GameAction =
  | { type: "ACKNOWLEDGE_BRIEFING" }
  | { type: "UPDATE_NOTEBOOK"; text: string }
  | { type: "EXAMINE_EVIDENCE"; evidenceId: string }
  | { type: "SHARE_EVIDENCE"; evidenceId: string }
  | { type: "SUBMIT_ANSWER"; puzzleId: string; answer: string }
  | { type: "REVEAL_HINT"; puzzleId: string };

/** One of this player's own items. Details arrive only once they examine it. */
export interface OwnEvidenceView {
  id: string;
  name: string;
  examined: boolean;
  shared: boolean;
  summary: string | null;
  details: readonly string[] | null;
}

/**
 * An item the partner shared. Deliberately has no details field: the partner
 * has to describe those out loud.
 */
export interface SharedEvidenceView {
  id: string;
  name: string;
  summary: string;
}

/** A puzzle as one player sees it. Never carries anything derived from the solution. */
export interface PuzzleView {
  id: string;
  name: string;
  prompt: string;
  unlocked: boolean;
  solved: boolean;
  attempts: number;
  /** Only the hints that have been revealed, in order. */
  hints: readonly string[];
  hintsRemaining: number;
  solvedNote: string | null;
  /** Why it is still shut, from this player's side. Null once open. */
  blockedBy: { yours: readonly string[]; partnerItems: number } | null;
}

/** One player's window onto the game: all of their own side, only the public part of their partner's. */
export interface PlayerGameView {
  phase: GamePhase;
  you: { role: PlayerRole; briefingAcknowledged: boolean; notebook: string };
  partner: { role: PlayerRole; briefingAcknowledged: boolean; sharedCount: number };
  evidence: { yours: OwnEvidenceView[]; fromPartner: SharedEvidenceView[] };
  puzzles: PuzzleView[];
}

const NO_PROGRESS: PuzzleProgress = { attempts: 0, solved: false, hintsRevealed: 0 };

const otherRole = (role: PlayerRole): PlayerRole => (role === "A" ? "B" : "A");

const progressOf = (state: GameState, puzzleId: string): PuzzleProgress =>
  state.puzzles[puzzleId] ?? NO_PROGRESS;

export function createInitialState(assignments: Record<PlayerRole, string>): GameState {
  const fresh = (playerId: string): PlayerGameState => ({
    playerId,
    briefingAcknowledged: false,
    notebook: "",
    examined: [],
    shared: [],
  });
  return {
    phase: "BRIEFING",
    players: { A: fresh(assignments.A), B: fresh(assignments.B) },
    puzzles: {},
  };
}

export function roleOf(state: GameState, playerId: string): PlayerRole {
  if (state.players.A.playerId === playerId) return "A";
  if (state.players.B.playerId === playerId) return "B";
  throw notRoomMember();
}

/**
 * Required evidence still unexamined, split by who holds it. A requirement the
 * case no longer defines is treated as met, so edited content cannot wedge a
 * game that is already under way.
 */
function outstanding(definition: CaseDefinition, state: GameState, puzzle: PuzzleDefinition) {
  const missing: Record<PlayerRole, string[]> = { A: [], B: [] };
  for (const id of puzzle.requires) {
    const item = findEvidence(definition, id);
    if (!item) continue;
    if (!state.players[item.heldBy].examined.includes(id)) missing[item.heldBy].push(item.name);
  }
  return missing;
}

const isUnlocked = (definition: CaseDefinition, state: GameState, puzzle: PuzzleDefinition) => {
  const missing = outstanding(definition, state, puzzle);
  return missing.A.length === 0 && missing.B.length === 0;
};

/** Returns a new state; the input is never mutated. Throws a DomainError when the action is not allowed. */
export function applyAction(
  definition: CaseDefinition,
  state: GameState,
  role: PlayerRole,
  action: GameAction,
): GameState {
  const self = state.players[role];
  const withPlayer = (patch: Partial<PlayerGameState>): GameState => ({
    ...state,
    players: { ...state.players, [role]: { ...self, ...patch } },
  });

  const requireInvestigation = () => {
    if (state.phase === "BRIEFING") throw invalidAction("The investigation has not started yet.");
  };

  /** Resolves an id to one of this role's own items, whatever a client claims. */
  const ownEvidence = (evidenceId: string) => {
    requireInvestigation();
    const item = findEvidence(definition, evidenceId);
    // Same message either way: a player should not learn what sits on their partner's side.
    if (!item || item.heldBy !== role) throw invalidAction("That is not something you can look at.");
    return item;
  };

  /** Resolves an id to a puzzle this pair may currently work on. */
  const openPuzzle = (puzzleId: string) => {
    requireInvestigation();
    const puzzle = findPuzzle(definition, puzzleId);
    if (!puzzle) throw invalidAction("There is no such question.");
    if (progressOf(state, puzzle.id).solved) throw invalidAction("You have already answered that one.");
    if (!isUnlocked(definition, state, puzzle)) {
      throw invalidAction("You are both still missing something you need for that.");
    }
    return puzzle;
  };

  const withPuzzle = (puzzleId: string, patch: Partial<PuzzleProgress>): GameState => ({
    ...state,
    puzzles: { ...state.puzzles, [puzzleId]: { ...progressOf(state, puzzleId), ...patch } },
  });

  switch (action.type) {
    case "ACKNOWLEDGE_BRIEFING": {
      if (state.phase !== "BRIEFING") throw invalidAction("The briefing is already over.");
      if (self.briefingAcknowledged) return state;
      const next = withPlayer({ briefingAcknowledged: true });
      const bothIn = next.players.A.briefingAcknowledged && next.players.B.briefingAcknowledged;
      return bothIn ? { ...next, phase: "INVESTIGATION" } : next;
    }
    case "UPDATE_NOTEBOOK": {
      if (action.text.length > NOTEBOOK_MAX_LENGTH) {
        throw invalidAction(`Notebooks hold up to ${NOTEBOOK_MAX_LENGTH} characters.`);
      }
      return withPlayer({ notebook: action.text });
    }
    case "EXAMINE_EVIDENCE": {
      const item = ownEvidence(action.evidenceId);
      if (self.examined.includes(item.id)) return state;
      return withPlayer({ examined: [...self.examined, item.id] });
    }
    case "SHARE_EVIDENCE": {
      const item = ownEvidence(action.evidenceId);
      if (!self.examined.includes(item.id)) throw invalidAction("Look at it yourself before passing it on.");
      if (self.shared.includes(item.id)) return state;
      return withPlayer({ shared: [...self.shared, item.id] });
    }
    case "SUBMIT_ANSWER": {
      const puzzle = openPuzzle(action.puzzleId);
      if (action.answer.length > ANSWER_MAX_LENGTH) {
        throw invalidAction(`Answers hold up to ${ANSWER_MAX_LENGTH} characters.`);
      }
      const before = progressOf(state, puzzle.id);
      // The answer itself is judged here and then dropped: it is never stored or sent on.
      const solved = isAnswerCorrect(puzzle.check, action.answer);
      const next = withPuzzle(puzzle.id, { attempts: before.attempts + 1, solved });
      const allSolved = definition.puzzles.every((p) => progressOf(next, p.id).solved);
      return allSolved ? { ...next, phase: "RESOLVED" } : next;
    }
    case "REVEAL_HINT": {
      const puzzle = openPuzzle(action.puzzleId);
      const revealed = progressOf(state, puzzle.id).hintsRevealed;
      if (revealed >= puzzle.hints.length) throw invalidAction("There are no more hints for that one.");
      return withPuzzle(puzzle.id, { hintsRevealed: revealed + 1 });
    }
  }
}

/**
 * The information boundary. Built field by field on purpose: a new private
 * field stays hidden from the partner unless someone deliberately adds it here.
 */
export function projectFor(
  definition: CaseDefinition,
  state: GameState,
  role: PlayerRole,
): PlayerGameView {
  const you = state.players[role];
  const partnerRole = otherRole(role);
  const partner = state.players[partnerRole];

  const yours: OwnEvidenceView[] = evidenceHeldBy(definition, role).map((item) => {
    const examined = you.examined.includes(item.id);
    return {
      id: item.id,
      name: item.name,
      examined,
      shared: you.shared.includes(item.id),
      summary: examined ? item.summary : null,
      details: examined ? item.details : null,
    };
  });

  // Only what the partner chose to hand over, and only its name and summary.
  const fromPartner: SharedEvidenceView[] = partner.shared.flatMap((id) => {
    const item = findEvidence(definition, id);
    return item && item.heldBy === partnerRole
      ? [{ id: item.id, name: item.name, summary: item.summary }]
      : [];
  });

  const puzzles: PuzzleView[] = definition.puzzles.map((puzzle) => {
    const progress = progressOf(state, puzzle.id);
    const missing = outstanding(definition, state, puzzle);
    const unlocked = missing.A.length === 0 && missing.B.length === 0;

    return {
      id: puzzle.id,
      name: puzzle.name,
      prompt: puzzle.prompt,
      unlocked,
      solved: progress.solved,
      attempts: progress.attempts,
      hints: puzzle.hints.slice(0, progress.hintsRevealed),
      hintsRemaining: puzzle.hints.length - progress.hintsRevealed,
      solvedNote: progress.solved ? (puzzle.solvedNote ?? null) : null,
      // Your own outstanding items by name; your partner's only as a count,
      // so a locked puzzle tells you to go and ask rather than what they hold.
      blockedBy: unlocked ? null : { yours: missing[role], partnerItems: missing[partnerRole].length },
    };
  });

  return {
    phase: state.phase,
    you: { role, briefingAcknowledged: you.briefingAcknowledged, notebook: you.notebook },
    partner: {
      role: partnerRole,
      briefingAcknowledged: partner.briefingAcknowledged,
      sharedCount: fromPartner.length,
    },
    evidence: { yours, fromPartner },
    puzzles,
  };
}
