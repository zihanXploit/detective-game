import { describe, expect, it } from "vitest";
import { isAnswerCorrect, validateCheck, type PuzzleCheck } from "./checkers";

describe("exact-text", () => {
  const check: PuzzleCheck = { kind: "exact-text", accept: ["quiet harbour", "quiet harbor"] };

  it("ignores case, padding and repeated spaces", () => {
    expect(isAnswerCorrect(check, "  Quiet   Harbour ")).toBe(true);
    expect(isAnswerCorrect(check, "quiet harbor")).toBe(true);
  });

  it("rejects anything else, including an empty answer", () => {
    expect(isAnswerCorrect(check, "quiet")).toBe(false);
    expect(isAnswerCorrect(check, "")).toBe(false);
    expect(isAnswerCorrect(check, "   ")).toBe(false);
  });

  it("can be made case sensitive", () => {
    const strict: PuzzleCheck = { kind: "exact-text", accept: ["Ark"], caseSensitive: true };
    expect(isAnswerCorrect(strict, "Ark")).toBe(true);
    expect(isAnswerCorrect(strict, "ark")).toBe(false);
  });

  it("reports an empty accept list", () => {
    expect(validateCheck({ kind: "exact-text", accept: [] })).toContain("accept must list at least one answer");
    expect(validateCheck({ kind: "exact-text", accept: [" "] })).toContain("accept contains an empty answer");
    expect(validateCheck(check)).toEqual([]);
  });
});

describe("number", () => {
  const check: PuzzleCheck = { kind: "number", value: 7 };

  it("accepts the number however it is typed", () => {
    expect(isAnswerCorrect(check, "7")).toBe(true);
    expect(isAnswerCorrect(check, " 7 ")).toBe(true);
    expect(isAnswerCorrect({ kind: "number", value: 1234 }, "1,234")).toBe(true);
  });

  it("rejects other numbers and anything unparseable", () => {
    for (const answer of ["8", "", "   ", "seven", "7abc", "NaN", "Infinity"]) {
      expect(isAnswerCorrect(check, answer), answer).toBe(false);
    }
  });

  it("honours a tolerance", () => {
    const loose: PuzzleCheck = { kind: "number", value: 10, tolerance: 2 };
    expect(isAnswerCorrect(loose, "8")).toBe(true);
    expect(isAnswerCorrect(loose, "12.5")).toBe(false);
  });

  it("reports a bad configuration", () => {
    expect(validateCheck({ kind: "number", value: Number.NaN })).toContain("value must be a finite number");
    expect(validateCheck({ kind: "number", value: 1, tolerance: -1 })).toContain("tolerance must be zero or more");
    expect(validateCheck(check)).toEqual([]);
  });
});

describe("an unknown kind", () => {
  // A save can outlive the checker that judged it; the app must not crash on one.
  const alien = { kind: "telepathy", value: 1 } as unknown as PuzzleCheck;

  it("is reported by validation and never accepts an answer", () => {
    expect(validateCheck(alien)).toEqual(['unknown puzzle kind "telepathy"']);
    expect(isAnswerCorrect(alien, "anything")).toBe(false);
  });
});
