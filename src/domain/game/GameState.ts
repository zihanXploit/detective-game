import { evidenceHeldBy, findEvidence, type CaseDefinition } from "@/domain/case/CaseDefinition";
import { invalidAction, notRoomMember } from "@/domain/errors";
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
 * state can always be replayed. Puzzles will extend the state and action types;
 * they must go through these same two functions.
 */

export type GamePhase = "BRIEFING" | "INVESTIGATION";

export const NOTEBOOK_MAX_LENGTH = 4000;

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

export interface GameState {
  phase: GamePhase;
  players: Record<PlayerRole, PlayerGameState>;
}

export type GameAction =
  | { type: "ACKNOWLEDGE_BRIEFING" }
  | { type: "UPDATE_NOTEBOOK"; text: string }
  | { type: "EXAMINE_EVIDENCE"; evidenceId: string }
  | { type: "SHARE_EVIDENCE"; evidenceId: string };

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

/** One player's window onto the game: all of their own side, only the public part of their partner's. */
export interface PlayerGameView {
  phase: GamePhase;
  you: { role: PlayerRole; briefingAcknowledged: boolean; notebook: string };
  partner: { role: PlayerRole; briefingAcknowledged: boolean; sharedCount: number };
  evidence: { yours: OwnEvidenceView[]; fromPartner: SharedEvidenceView[] };
}

const otherRole = (role: PlayerRole): PlayerRole => (role === "A" ? "B" : "A");

export function createInitialState(assignments: Record<PlayerRole, string>): GameState {
  const fresh = (playerId: string): PlayerGameState => ({
    playerId,
    briefingAcknowledged: false,
    notebook: "",
    examined: [],
    shared: [],
  });
  return { phase: "BRIEFING", players: { A: fresh(assignments.A), B: fresh(assignments.B) } };
}

export function roleOf(state: GameState, playerId: string): PlayerRole {
  if (state.players.A.playerId === playerId) return "A";
  if (state.players.B.playerId === playerId) return "B";
  throw notRoomMember();
}

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

  /** Resolves an id to one of this role's own items, whatever a client claims. */
  const ownEvidence = (evidenceId: string) => {
    if (state.phase !== "INVESTIGATION") throw invalidAction("The investigation has not started yet.");
    const item = findEvidence(definition, evidenceId);
    // Same message either way: a player should not learn what sits on their partner's side.
    if (!item || item.heldBy !== role) throw invalidAction("That is not something you can look at.");
    return item;
  };

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

  return {
    phase: state.phase,
    you: { role, briefingAcknowledged: you.briefingAcknowledged, notebook: you.notebook },
    partner: {
      role: partnerRole,
      briefingAcknowledged: partner.briefingAcknowledged,
      sharedCount: fromPartner.length,
    },
    evidence: { yours, fromPartner },
  };
}
