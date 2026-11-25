import { validateCheck, type PuzzleCheck } from "./checkers";

/**
 * A puzzle as an author writes it. `check` is server-only content: it holds the
 * solution, so nothing built from it may reach a browser.
 */
export interface PuzzleDefinition {
  /** Unique within the case. Stored in saves, so it must not change once released. */
  id: string;
  /** Shown to both players once unlocked. */
  name: string;
  /** The question being asked. Shown to both players. */
  prompt: string;
  /**
   * Evidence that must be examined before this puzzle opens. Listing items from
   * both sides is what forces the pair to pool what they have found.
   */
  requires: readonly string[];
  check: PuzzleCheck;
  /** Revealed one at a time, to both players, in order. */
  hints: readonly string[];
  /** Shown to both once solved. */
  solvedNote?: string;
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isBlank = (text: unknown) => typeof text !== "string" || text.trim().length === 0;

/**
 * Checks one puzzle against the evidence ids its case defines.
 * Returns every problem found. Empty means valid.
 */
export function validatePuzzle(puzzle: PuzzleDefinition, knownEvidenceIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const where = `puzzle "${puzzle.id}"`;

  if (!ID_PATTERN.test(puzzle.id) || puzzle.id.length > 64) {
    problems.push(`${where}: id must be lowercase letters, digits and single hyphens, at most 64 characters`);
  }
  if (isBlank(puzzle.name)) problems.push(`${where}: has no name`);
  if (isBlank(puzzle.prompt)) problems.push(`${where}: has no prompt`);
  if (puzzle.hints.some(isBlank)) problems.push(`${where}: has an empty hint`);
  if (puzzle.solvedNote !== undefined && isBlank(puzzle.solvedNote)) {
    problems.push(`${where}: has an empty solvedNote`);
  }

  for (const id of puzzle.requires) {
    if (!knownEvidenceIds.has(id)) problems.push(`${where}: requires unknown evidence "${id}"`);
  }
  if (new Set(puzzle.requires).size !== puzzle.requires.length) {
    problems.push(`${where}: lists the same required evidence twice`);
  }

  for (const problem of validateCheck(puzzle.check)) problems.push(`${where}: ${problem}`);
  return problems;
}
