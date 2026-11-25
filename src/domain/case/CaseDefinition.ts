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

/** One role's slice of a case. The other role's briefing is deliberately absent. */
export interface CaseFile {
  title: string;
  yourRole: { name: string; summary: string; briefing: readonly string[] };
  partnerRoleName: string;
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
