import type { CaseDefinition } from "@/domain/case/CaseDefinition";

/**
 * NOT A REAL CASE. Neutral filler used to exercise the case system end to end
 * until the first real case is written. Remove it from ALL_CASES before release.
 */
export const engineCheck: CaseDefinition = {
  slug: "engine-check",
  version: 2,
  title: "Engine Check (test case)",
  synopsis: "A content-free test case for trying out the game. There is no mystery to solve here.",
  estimatedMinutes: 2,
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
      summary: "Placeholder summary for Tester One's first item.",
      details: [
        "Placeholder details for Tester One's first item. Only Tester One ever receives this text.",
        "If you share this item, your partner sees its name and summary. Read these details aloud to pass them on.",
      ],
    },
    {
      id: "one-second-item",
      heldBy: "A",
      name: "Test item One-2",
      summary: "Placeholder summary for Tester One's second item.",
      details: ["Placeholder details for Tester One's second item."],
    },
    {
      id: "two-first-item",
      heldBy: "B",
      name: "Test item Two-1",
      summary: "Placeholder summary for Tester Two's first item.",
      details: [
        "Placeholder details for Tester Two's first item. Only Tester Two ever receives this text.",
        "If you share this item, your partner sees its name and summary. Read these details aloud to pass them on.",
      ],
    },
    {
      id: "two-second-item",
      heldBy: "B",
      name: "Test item Two-2",
      summary: "Placeholder summary for Tester Two's second item.",
      details: ["Placeholder details for Tester Two's second item."],
    },
  ],
};
