import { validatePuzzle, type PuzzleDefinition } from "@/domain/puzzle/PuzzleDefinition";
import type { PlayerRole } from "@/domain/room/Room";

/**
 * A case is authored as plain data in this shape. Everything a player can
 * read or do in a case will eventually be described here; for now that is
 * its identity and each role's private briefing.
 */
export interface CaseRoleDefinition {
  /** What this side is called in the fiction. Public: shown to both players. */
  name: string;
  /** One line on what playing this side is like. Public. */
  summary: string;
  /** Paragraphs only this role may read. */
  briefing: readonly string[];
}

/**
 * A piece of evidence sitting on one role's side of the case.
 *
 * The split between `summary` and `details` is what makes the pair talk:
 * sharing an item hands the partner its name and summary, never its details.
 * To pass those on, a player has to describe them out loud.
 */
export interface EvidenceDefinition {
  /** Unique within the case. Stored in saves, so it must not change once released. */
  id: string;
  /** Whose side this sits on. Only that role can examine it. */
  heldBy: PlayerRole;
  /** Known to its holder before examining it, and to the partner once shared. */
  name: string;
  /** One line revealed by examining. Travels with the item when it is shared. */
  summary: string;
  /** Paragraphs only the holder ever receives. */
  details: readonly string[];
}

export interface CaseDefinition {
  /** Stable identifier. Saved with every session, so it must never change once released. */
  slug: string;
  /** Bump whenever the content changes in a way that could affect a saved game. */
  version: number;
  title: string;
  /** Spoiler-free pitch shown in the lobby. */
  synopsis: string;
  estimatedMinutes: number;
  roles: Record<PlayerRole, CaseRoleDefinition>;
  evidence: readonly EvidenceDefinition[];
  /** Solving all of them closes the case. Their `check` content stays on the server. */
  puzzles: readonly PuzzleDefinition[];
}

/** What anyone may know about a case before playing it. */
export interface CaseSummary {
  slug: string;
  title: string;
  synopsis: string;
  estimatedMinutes: number;
  roleNames: Record<PlayerRole, string>;
  roleSummaries: Record<PlayerRole, string>;
}

/** One role's slice of a case. The other role's briefing and evidence are deliberately absent. */
export interface CaseFile {
  title: string;
  yourRole: { name: string; summary: string; briefing: readonly string[] };
  partnerRoleName: string;
}

/** The items one role may examine, in authoring order. */
export function evidenceHeldBy(definition: CaseDefinition, role: PlayerRole): readonly EvidenceDefinition[] {
  return definition.evidence.filter((item) => item.heldBy === role);
}

export function findEvidence(definition: CaseDefinition, id: string): EvidenceDefinition | undefined {
  return definition.evidence.find((item) => item.id === id);
}

export function findPuzzle(definition: CaseDefinition, id: string): PuzzleDefinition | undefined {
  return definition.puzzles.find((puzzle) => puzzle.id === id);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROLES: readonly PlayerRole[] = ["A", "B"];
const isBlank = (text: unknown) => typeof text !== "string" || text.trim().length === 0;

/** Returns every problem found, so an author sees them all at once. Empty means valid. */
export function validateCase(definition: CaseDefinition): string[] {
  const problems: string[] = [];

  if (!SLUG_PATTERN.test(definition.slug) || definition.slug.length > 64) {
    problems.push("slug must be lowercase letters, digits and single hyphens, at most 64 characters");
  }
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    problems.push("version must be a positive whole number");
  }
  if (isBlank(definition.title)) problems.push("title is empty");
  if (isBlank(definition.synopsis)) problems.push("synopsis is empty");
  if (!Number.isInteger(definition.estimatedMinutes) || definition.estimatedMinutes < 1) {
    problems.push("estimatedMinutes must be a positive whole number");
  }

  for (const role of ROLES) {
    const side = definition.roles[role];
    if (!side) {
      problems.push(`role ${role} is missing`);
      continue;
    }
    if (isBlank(side.name)) problems.push(`role ${role} has no name`);
    if (isBlank(side.summary)) problems.push(`role ${role} has no summary`);
    if (side.briefing.length === 0) problems.push(`role ${role} has no briefing`);
    if (side.briefing.some(isBlank)) problems.push(`role ${role} has an empty briefing paragraph`);
  }

  const { A, B } = definition.roles;
  if (A && B && !isBlank(A.name) && A.name.trim().toLowerCase() === B.name.trim().toLowerCase()) {
    problems.push("both roles have the same name");
  }

  const seenIds = new Set<string>();
  for (const item of definition.evidence) {
    const where = `evidence "${item.id}"`;
    if (!SLUG_PATTERN.test(item.id) || item.id.length > 64) {
      problems.push(`${where}: id must be lowercase letters, digits and single hyphens, at most 64 characters`);
    }
    if (seenIds.has(item.id)) problems.push(`${where}: id is used by more than one item`);
    seenIds.add(item.id);

    if (!ROLES.includes(item.heldBy)) problems.push(`${where}: heldBy must be A or B`);
    if (isBlank(item.name)) problems.push(`${where}: has no name`);
    if (isBlank(item.summary)) problems.push(`${where}: has no summary`);
    if (item.details.length === 0) problems.push(`${where}: has no details`);
    if (item.details.some(isBlank)) problems.push(`${where}: has an empty details paragraph`);
  }

  // A side with nothing to find has nothing to contribute, which breaks the co-operative premise.
  for (const role of ROLES) {
    if (!definition.evidence.some((item) => item.heldBy === role)) {
      problems.push(`role ${role} has no evidence to find`);
    }
  }

  const heldBy = new Map(definition.evidence.map((item) => [item.id, item.heldBy]));
  const seenPuzzleIds = new Set<string>();
  for (const puzzle of definition.puzzles) {
    for (const problem of validatePuzzle(puzzle, new Set(heldBy.keys()))) problems.push(problem);
    if (seenPuzzleIds.has(puzzle.id)) problems.push(`puzzle "${puzzle.id}": id is used by more than one puzzle`);
    seenPuzzleIds.add(puzzle.id);
  }

  if (definition.puzzles.length === 0) {
    problems.push("the case has no puzzles, so it can never be closed");
  } else if (
    // The whole premise is that neither player can finish alone.
    !definition.puzzles.some((puzzle) => {
      const sides = new Set(puzzle.requires.map((id) => heldBy.get(id)));
      return sides.has("A") && sides.has("B");
    })
  ) {
    problems.push("no puzzle needs evidence from both roles, so the case can be solved by one player");
  }
  return problems;
}

export function summariseCase(definition: CaseDefinition): CaseSummary {
  return {
    slug: definition.slug,
    title: definition.title,
    synopsis: definition.synopsis,
    estimatedMinutes: definition.estimatedMinutes,
    roleNames: { A: definition.roles.A.name, B: definition.roles.B.name },
    roleSummaries: { A: definition.roles.A.summary, B: definition.roles.B.summary },
  };
}

/** The information boundary for case content, matching projectFor for game state. */
export function caseFileFor(definition: CaseDefinition, role: PlayerRole): CaseFile {
  const yours = definition.roles[role];
  const partner = definition.roles[role === "A" ? "B" : "A"];
  return {
    title: definition.title,
    yourRole: { name: yours.name, summary: yours.summary, briefing: yours.briefing },
    partnerRoleName: partner.name,
  };
}
