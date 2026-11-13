import { NextResponse } from "next/server";
import { isDomainError, type DomainErrorCode } from "@/domain/errors";
import { RateLimiter } from "@/infrastructure/security/RateLimiter";
import { playerNameSchema } from "@/shared/realtime/schemas";

export interface ApiError {
  error: { code: string; message: string };
}

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  INVALID_DISPLAY_NAME: 400,
  INVALID_ROOM_CODE: 400,
  ROOM_NOT_FOUND: 404,
  NOT_ROOM_MEMBER: 403,
  NOT_HOST: 403,
  ROOM_LOCKED: 409,
  ROOM_NOT_READY: 409,
  ROLE_TAKEN: 409,
  ROLE_REQUIRED: 409,
  GAME_NOT_STARTED: 409,
  INVALID_ACTION: 400,
  STATE_CONFLICT: 409,
  ROOM_FULL: 409,
  ROOM_NOT_JOINABLE: 409,
  ROOM_CODE_TAKEN: 409,
  ROOM_CODE_EXHAUSTED: 503,
};

export function fail(status: number, code: string, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function failFrom(err: unknown): NextResponse<ApiError> {
  if (isDomainError(err)) return fail(STATUS_BY_CODE[err.code] ?? 400, err.code, err.message);
  console.error("[http] unexpected error", err);
  return fail(500, "INTERNAL", "Something went wrong. Please try again.");
}

export async function readPlayerName(request: Request): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = playerNameSchema.safeParse(body);
  return parsed.success ? parsed.data.displayName : null;
}

const globalForLimiters = globalThis as unknown as { roomLimiters?: Record<string, RateLimiter> };
const limiters = (globalForLimiters.roomLimiters ??= {
  // Creating rooms writes rows; joining is the endpoint someone would hammer to guess codes.
  create: new RateLimiter(10, 60_000),
  join: new RateLimiter(20, 60_000),
});

/**
 * Keyed by client IP. X-Forwarded-For is only trustworthy behind a proxy that overwrites it,
 * so deploy behind one (or swap this for the platform's own client-IP header).
 */
export function isRateLimited(request: Request, bucket: "create" | "join"): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return !limiters[bucket]!.allow(ip);
}
