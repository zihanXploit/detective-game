import { describe, expect, it } from "vitest";
import { caseFileFor, summariseCase, validateCase, type CaseDefinition } from "./CaseDefinition";

const valid = (): CaseDefinition => ({
  slug: "sample-case",
  version: 1,
  title: "Sample",
  synopsis: "A sample.",
  estimatedMinutes: 10,
  roles: {
    A: { name: "First", summary: "Goes first.", briefing: ["ONLY-A-MAY-READ-THIS"] },
    B: { name: "Second", summary: "Goes second.", briefing: ["ONLY-B-MAY-READ-THIS"] },
  },
  evidence: [
    { id: "a-one", heldBy: "A", name: "A's item", summary: "A summary.", details: ["A details."] },
    { id: "b-one", heldBy: "B", name: "B's item", summary: "B summary.", details: ["B details."] },
  ],
  puzzles: [
    {
      id: "both-sides",
      name: "Together",
      prompt: "Needs both of you.",
      requires: ["a-one", "b-one"],
      check: { kind: "exact-text", accept: ["yes"] },
      hints: [],
    },
  ],
});

describe("validateCase", () => {
  it("accepts a well-formed case", () => {
    expect(validateCase(valid())).toEqual([]);
  });

  it("reports every problem at once", () => {
    const broken: CaseDefinition = {
      ...valid(),
      slug: "Not A Slug",
      version: 0,
      title: " ",
      estimatedMinutes: 2.5,
      roles: {
        A: { name: "Same", summary: "", briefing: [] },
        B: { name: "same", summary: "ok", briefing: ["fine", "  "] },
      },
    };
    const problems = validateCase(broken);
    expect(problems).toHaveLength(8);
    expect(problems.join("\n")).toMatch(/slug/);
    expect(problems.join("\n")).toMatch(/both roles have the same name/);
  });

  it("reports malformed, duplicated and one-sided evidence", () => {
    const problems = validateCase({
      ...valid(),
      evidence: [
        { id: "Bad Id", heldBy: "A", name: "", summary: " ", details: [] },
        { id: "a-one", heldBy: "A", name: "First", summary: "ok", details: ["x"] },
        { id: "a-one", heldBy: "A", name: "Copy", summary: "ok", details: [" "] },
      ],
    }).join("\n");

    expect(problems).toMatch(/evidence "Bad Id": id must be lowercase/);
    expect(problems).toMatch(/has no name/);
    expect(problems).toMatch(/id is used by more than one item/);
    expect(problems).toMatch(/empty details paragraph/);
    expect(problems).toMatch(/role B has no evidence to find/);
  });

  it("reports malformed puzzles and unknown requirements", () => {
    const problems = validateCase({
      ...valid(),
      puzzles: [
        {
          id: "Bad Id",
          name: "",
          prompt: " ",
          requires: ["a-one", "a-one", "ghost"],
          check: { kind: "exact-text", accept: [] },
          hints: [" "],
        },
      ],
    }).join("\n");

    expect(problems).toMatch(/puzzle "Bad Id": id must be lowercase/);
    expect(problems).toMatch(/has no name/);
    expect(problems).toMatch(/requires unknown evidence "ghost"/);
    expect(problems).toMatch(/lists the same required evidence twice/);
    expect(problems).toMatch(/accept must list at least one answer/);
    expect(problems).toMatch(/has an empty hint/);
  });

  it("refuses a case that one player could finish alone", () => {
    const oneSided = validateCase({
      ...valid(),
      puzzles: [
        {
          id: "solo",
          name: "Solo",
          prompt: "One side only.",
          requires: ["a-one"],
          check: { kind: "exact-text", accept: ["yes"] },
          hints: [],
        },
      ],
    });
    expect(oneSided.join("\n")).toMatch(/no puzzle needs evidence from both roles/);

    expect(validateCase({ ...valid(), puzzles: [] }).join("\n")).toMatch(/no puzzles/);
  });
});

describe("summariseCase", () => {
  it("exposes names and summaries but no briefing text", () => {
    const summary = JSON.stringify(summariseCase(valid()));
    expect(summary).toContain("First");
    expect(summary).not.toContain("MAY-READ-THIS");
  });
});

describe("caseFileFor", () => {
  it("gives a role its own briefing and only the partner's role name", () => {
    const file = caseFileFor(valid(), "A");
    expect(file.yourRole.briefing).toEqual(["ONLY-A-MAY-READ-THIS"]);
    expect(file.partnerRoleName).toBe("Second");
    expect(JSON.stringify(file)).not.toContain("ONLY-B-MAY-READ-THIS");
    expect(JSON.stringify(caseFileFor(valid(), "B"))).not.toContain("ONLY-A-MAY-READ-THIS");
  });
});
