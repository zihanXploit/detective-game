import type { ZodType } from "zod";
import { isDomainError } from "@/domain/errors";
import { RateLimiter } from "@/infrastructure/security/RateLimiter";
import type { Ack, Result } from "@/shared/realtime/contract";
import type { KeyedSerialQueue } from "./KeyedSerialQueue";

/** Generous for a human clicking through a lobby or a puzzle; tight for a script. */
const EVENTS_PER_WINDOW = 40;
const WINDOW_MS = 10_000;

function toFailure(err: unknown): Result<never> {
  if (isDomainError(err)) {
    return { ok: false, error: { code: err.code, message: err.message } };
  }
  console.error("[realtime] unexpected error", err);
  return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } };
}

const refuse = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message } });

/**
 * Builds the one pipeline every client command for a connection goes through:
 *
 *   rate limit -> validate payload -> resolve room -> wait for the room's turn -> run -> ack
 *
 * The client always gets exactly one ack, and nothing a handler throws can
 * reach the process as an unhandled rejection.
 */
export function createCommandHandler(queue: KeyedSerialQueue) {
  const limiter = new RateLimiter(EVENTS_PER_WINDOW, WINDOW_MS);

  return function command<P, T>(
    schema: ZodType<P>,
    /** Which room the command acts on. May throw (bad code, not in a room). */
    resolveRoom: (payload: P) => string,
    run: (payload: P, roomCode: string) => Promise<T>,
  ) {
    return async (raw: unknown, ack?: Ack<T>) => {
      const reply: Ack<T> = typeof ack === "function" ? ack : () => {};

      if (!limiter.allow("commands")) {
        reply(refuse("RATE_LIMITED", "You are doing that too fast. Wait a moment."));
        return;
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        reply(refuse("BAD_REQUEST", "Malformed request."));
        return;
      }
      try {
        const roomCode = resolveRoom(parsed.data);
        reply({ ok: true, data: await queue.run(roomCode, () => run(parsed.data, roomCode)) });
      } catch (err) {
        reply(toFailure(err));
      }
    };
  };
}
