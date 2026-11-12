import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "dt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const sign = (playerId: string, secret: string) =>
  createHmac("sha256", secret).update(playerId).digest("base64url");

/** Token format: `<playerId>.<hmac>`. Stateless, so HTTP and the socket server verify it the same way. */
export function createSessionToken(playerId: string, secret: string): string {
  return `${playerId}.${sign(playerId, secret)}`;
}

export function verifySessionToken(token: string, secret: string): string | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const playerId = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(playerId, secret));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  return playerId;
}

/** Minimal Cookie header reader for the socket handshake, where next/headers is unavailable. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
