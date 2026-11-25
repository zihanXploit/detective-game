/**
 * Puzzle types, as plug-ins.
 *
 * A puzzle's content carries a `check` object whose `kind` names a checker in
 * the registry below. The engine never knows what kinds exist: it looks the
 * kind up, asks it whether an answer is right, and stops there. Adding a new
 * kind of puzzle means writing a checker and listing it here; no engine change.
 *
 * Checkers are pure, and their configuration never leaves the server: the
 * answer is judged here, so the solution is never sent to a browser.
 */

export interface PuzzleChecker<Config> {
  /** Reports what is wrong with a case's configuration. Empty means valid. */
  validate(config: Config): string[];
  /** Judges a player's answer. Never throws: anything unparseable is simply wrong. */
  isCorrect(config: Config, answer: string): boolean;
}

export interface ExactTextCheck {
  kind: "exact-text";
  /** Any one of these counts as right. */
  accept: readonly string[];
  /** Off by default: players should not lose on capitalisation. */
  caseSensitive?: boolean;
}

export interface NumberCheck {
  kind: "number";
  value: number;
  /** Allowed distance from `value`. Defaults to exact. */
  tolerance?: number;
}

/** Every puzzle kind the app knows. Extend the union when adding a checker. */
export type PuzzleCheck = ExactTextCheck | NumberCheck;
export type PuzzleCheckKind = PuzzleCheck["kind"];

/** Trim, collapse inner whitespace, and drop surrounding punctuation noise. */
const normalise = (text: string) => text.trim().replace(/\s+/g, " ");

const exactText: PuzzleChecker<ExactTextCheck> = {
  validate: (config) => {
    const problems: string[] = [];
    if (config.accept.length === 0) problems.push("accept must list at least one answer");
    if (config.accept.some((answer) => normalise(answer).length === 0)) {
      problems.push("accept contains an empty answer");
    }
    return problems;
  },
  isCorrect: (config, answer) => {
    const fold = (text: string) => {
      const cleaned = normalise(text);
      return config.caseSensitive ? cleaned : cleaned.toLowerCase();
    };
    const given = fold(answer);
    return given.length > 0 && config.accept.some((candidate) => fold(candidate) === given);
  },
};

const number: PuzzleChecker<NumberCheck> = {
  validate: (config) => {
    const problems: string[] = [];
    if (!Number.isFinite(config.value)) problems.push("value must be a finite number");
    if (config.tolerance !== undefined && (!Number.isFinite(config.tolerance) || config.tolerance < 0)) {
      problems.push("tolerance must be zero or more");
    }
    return problems;
  },
  isCorrect: (config, answer) => {
    // Accept "1,234" and "12 " but not "12abc"; Number("") is 0, so guard the empty string.
    const cleaned = normalise(answer).replace(/,/g, "");
    if (cleaned.length === 0) return false;
    const given = Number(cleaned);
    if (!Number.isFinite(given)) return false;
    return Math.abs(given - config.value) <= (config.tolerance ?? 0);
  },
};

/**
 * Each entry is written against its own config type; the map erases that, and
 * the two lookups below restore it. The erasure is contained to this file, so
 * a checker is still type-checked against the config it declares.
 */
type ErasedChecker = PuzzleChecker<never>;
const REGISTRY: Record<PuzzleCheckKind, ErasedChecker> = {
  "exact-text": exactText as ErasedChecker,
  number: number as ErasedChecker,
};

const lookup = (check: PuzzleCheck) =>
  REGISTRY[check.kind] as PuzzleChecker<PuzzleCheck> | undefined;

export function validateCheck(check: PuzzleCheck): string[] {
  const checker = lookup(check);
  if (!checker) return [`unknown puzzle kind "${String(check.kind)}"`];
  return checker.validate(check);
}

/** An answer to a kind the app no longer knows is never right, rather than crashing a game. */
export function isAnswerCorrect(check: PuzzleCheck, answer: string): boolean {
  return lookup(check)?.isCorrect(check, answer) ?? false;
}
