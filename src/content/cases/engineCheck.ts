import type { CaseDefinition } from "@/domain/case/CaseDefinition";

/**
 * NOT A REAL CASE. Neutral filler used to exercise the engine end to end until
 * the first real case is written. Its puzzles are deliberately mechanical: each
 * one needs a number or word that sits in the other player's details, so it can
 * only be answered after the pair have talked. Remove it from ALL_CASES before release.
 */
export const engineCheck: CaseDefinition = {
  slug: "engine-check",
  version: 3,
  title: "Engine Check (test case)",
  synopsis: "A content-free test case for trying out the game. There is no mystery to solve here.",
  estimatedMinutes: 5,
  roles: {
    A: {
      name: "Tester One",
      summary: "Receives the first half of the test briefing.",
      briefing: [
        "This is placeholder briefing text for Tester One. It exists only to confirm that each player receives their own briefing.",
        "Your partner cannot see this text. Their briefing is different from yours.",
      ],
    },
    B: {
      name: "Tester Two",
      summary: "Receives the second half of the test briefing.",
      briefing: [
        "This is placeholder briefing text for Tester Two. It exists only to confirm that each player receives their own briefing.",
        "Your partner cannot see this text. Their briefing is different from yours.",
      ],
    },
  },
  evidence: [
    {
      id: "one-first-item",
      heldBy: "A",
      name: "Test item One-1",
      summary: "Placeholder summary for Tester One's first item. It carries a number.",
      details: [
        "The number written on this item is 3.",
        "Sharing this item shows your partner its name and summary only. Read this number out to them.",
      ],
    },
    {
      id: "one-second-item",
      heldBy: "A",
      name: "Test item One-2",
      summary: "Placeholder summary for Tester One's second item. It carries a word.",
      details: ["The word written on this item is: quiet."],
    },
    {
      id: "two-first-item",
      heldBy: "B",
      name: "Test item Two-1",
      summary: "Placeholder summary for Tester Two's first item. It carries a number.",
      details: [
        "The number written on this item is 4.",
        "Sharing this item shows your partner its name and summary only. Read this number out to them.",
      ],
    },
    {
      id: "two-second-item",
      heldBy: "B",
      name: "Test item Two-2",
      summary: "Placeholder summary for Tester Two's second item. It carries a word.",
      details: ["The word written on this item is: harbour."],
    },
  ],
  puzzles: [
    {
      id: "test-total",
      name: "The two numbers",
      prompt: "Add the number on Tester One's first item to the number on Tester Two's first item.",
      requires: ["one-first-item", "two-first-item"],
      check: { kind: "number", value: 7 },
      hints: ["Each of those items states its number in its details.", "One of them is 3."],
      solvedNote: "Correct. That is the first half of this test case.",
    },
    {
      id: "test-phrase",
      name: "The two words",
      prompt: "Put Tester One's word in front of Tester Two's word, separated by a space.",
      requires: ["one-second-item", "two-second-item"],
      check: { kind: "exact-text", accept: ["quiet harbour", "quiet harbor"] },
      hints: ["Each second item states its word in its details."],
      solvedNote: "Correct. That closes the test case.",
    },
  ],
};
