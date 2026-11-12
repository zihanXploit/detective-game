import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getEnv } from "@/infrastructure/config/env";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "@/infrastructure/security/sessionToken";

export async function readSessionPlayerId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token, getEnv().SESSION_SECRET) : null;
}

export function attachSession<T>(response: NextResponse<T>, playerId: string): NextResponse<T> {
  const env = getEnv();
  response.cookies.set(SESSION_COOKIE, createSessionToken(playerId, env.SESSION_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
