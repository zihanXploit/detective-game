import type { CaseCatalog } from "@/application/ports";
import { summariseCase, validateCase, type CaseDefinition, type CaseSummary } from "@/domain/case/CaseDefinition";

/**
 * Serves the cases compiled into the app. Every case is validated when the
 * catalog is built, so a malformed case stops the server at startup instead
 * of failing in the middle of someone's game.
 */
export class StaticCaseCatalog implements CaseCatalog {
  private readonly bySlug = new Map<string, CaseDefinition>();
  private readonly summaries: CaseSummary[];

  constructor(definitions: readonly CaseDefinition[]) {
    const problems: string[] = [];
    for (const definition of definitions) {
      for (const problem of validateCase(definition)) problems.push(`${definition.slug}: ${problem}`);
      if (this.bySlug.has(definition.slug)) problems.push(`${definition.slug}: slug is used by more than one case`);
      this.bySlug.set(definition.slug, definition);
    }
    if (problems.length > 0) {
      throw new Error(`Invalid case content:\n  - ${problems.join("\n  - ")}`);
    }
    this.summaries = definitions.map(summariseCase);
  }

  list(): readonly CaseSummary[] {
    return this.summaries;
  }

  find(slug: string): CaseDefinition | null {
    return this.bySlug.get(slug) ?? null;
  }
}
