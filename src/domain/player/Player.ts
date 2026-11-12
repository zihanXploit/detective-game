import { invalidDisplayName } from "@/domain/errors";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 24;

export interface Player {
  readonly id: string;
  readonly displayName: string;
}

/** Normalises whitespace and strips control characters before enforcing length. */
export function parseDisplayName(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const length = [...cleaned].length;
  if (length < DISPLAY_NAME_MIN || length > DISPLAY_NAME_MAX) throw invalidDisplayName();
  return cleaned;
}
