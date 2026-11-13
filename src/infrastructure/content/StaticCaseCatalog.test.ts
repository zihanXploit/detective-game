import { describe, expect, it } from "vitest";
import { ALL_CASES } from "@/content/cases";
import type { CaseDefinition } from "@/domain/case/CaseDefinition";
import { StaticCaseCatalog } from "./StaticCaseCatalog";

const sample = (slug: string): CaseDefinition => ({
  slug,
  version: 1,
  title: "Sample",
  synopsis: "A sample.",
  estimatedMinutes: 10,
  roles: {
    A: { name: "First", summary: "Goes first.", briefing: ["a"] },
    B: { name: "Second", summary: "Goes second.", briefing: ["b"] },
  },
});

describe("StaticCaseCatalog", () => {
  it("lists and finds cases", () => {
    const catalog = new StaticCaseCatalog([sample("one"), sample("two")]);
    expect(catalog.list().map((c) => c.slug)).toEqual(["one", "two"]);
    expect(catalog.find("two")?.slug).toBe("two");
    expect(catalog.find("missing")).toBeNull();
  });

  it("refuses to be built from invalid or duplicate cases, naming each problem", () => {
    const broken = { ...sample("bad"), title: "" };
    expect(() => new StaticCaseCatalog([sample("one"), sample("one"), broken])).toThrow(
      /one: slug is used by more than one case[\s\S]*bad: title is empty/,
    );
  });

  it("accepts every case shipped with the app", () => {
    expect(() => new StaticCaseCatalog(ALL_CASES)).not.toThrow();
    expect(ALL_CASES.length).toBeGreaterThan(0);
  });
});
