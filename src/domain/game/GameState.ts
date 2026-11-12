import { invalidAction, notRoomMember } from "@/domain/errors";
import type { PlayerRole } from "@/domain/room/Room";

/**
 * The game engine's core: plain data plus pure functions.
 *
 *   applyAction(state, role, action) -> next state      (the only way state changes)
 *   projectFor(state, role)          -> what that player may see
 *
 * No I/O, no clock, no randomness, so every rule is unit-testable and a saved
 * state can always be replayed. Cases, evidence and puzzles will extend the
 * state and action types; they must go through these same two functions.
 */

export type GamePhase = "BRIEFING" | "INVESTIGATION";

export const NOTEBOOK_MAX_LENGTH = 4000;

/** Everything the server knows about one side of the case. Never sent to the other side as-is. */
export interface PlayerGameState {
  playerId: string;
  briefingAcknowledged: boolean;
  /** Private scratch space. The partner must never receive it. */
  notebook: string;
}

export interface GameState {
  phase: GamePhase;
  players: Record<PlayerRole, PlayerGameState>;
}

export type GameAction =
  | { type: "ACKNOWLEDGE_BRIEFING" }
  | { type: "UPDATE_NOTEBOOK"; text: string };

/** One player's window onto the game: all of their own side, only the public part of their partner's. */
export interface PlayerGameView {
  phase: GamePhase;
  you: { role: PlayerRole; briefingAcknowledged: boolean; notebook: string };
  partner: { role: PlayerRole; briefingAcknowledged: boolean };
}

const otherRole = (role: PlayerRole): PlayerRole => (role === "A" ? "B" : "A");

export function createInitialState(assignments: Record<PlayerRole, string>): GameState {
  const fresh = (playerId: string): PlayerGameState => ({
    playerId,
    briefingAcknowledged: false,
    notebook: "",
  });
  return { phase: "BRIEFING", players: { A: fresh(assignments.A), B: fresh(assignments.B) } };
}

export function roleOf(state: GameState, playerId: string): PlayerRole {
  if (state.players.A.playerId === playerId) return "A";
  if (state.players.B.playerId === playerId) return "B";
  throw notRoomMember();
}

/** Returns a new state; the input is never mutated. Throws a DomainError when the action is not allowed. */
export function applyAction(state: GameState, role: PlayerRole, action: GameAction): GameState {
  const withPlayer = (patch: Partial<PlayerGameState>): GameState => ({
    ...state,
    players: { ...state.players, [role]: { ...state.players[role], ...patch } },
  });

  switch (action.type) {
    case "ACKNOWLEDGE_BRIEFING": {
      if (state.phase !== "BRIEFING") throw invalidAction("The briefing is already over.");
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
  }
}

/**
 * The information boundary. Built field by field on purpose: a new private
 * field stays hidden from the partner unless someone deliberately adds it here.
 */
export function projectFor(state: GameState, role: PlayerRole): PlayerGameView {
  const you = state.players[role];
  const partnerRole = otherRole(role);
  const partner = state.players[partnerRole];

  return {
    phase: state.phase,
    you: { role, briefingAcknowledged: you.briefingAcknowledged, notebook: you.notebook },
    partner: { role: partnerRole, briefingAcknowledged: partner.briefingAcknowledged },
  };
}
