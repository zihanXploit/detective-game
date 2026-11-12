import { NextResponse } from "next/server";
import { getHttpContainer } from "@/infrastructure/container";
import { fail, failFrom, isRateLimited, readPlayerName } from "@/infrastructure/http/respond";
import { attachSession, readSessionPlayerId } from "@/infrastructure/http/session";

export const runtime = "nodejs";

/** POST /api/rooms/:code/join — take the free seat, or return to a seat already held. */
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (isRateLimited(request, "join")) {
    return fail(429, "RATE_LIMITED", "Too many attempts. Wait a minute and try again.");
  }
  const displayName = await readPlayerName(request);
  if (displayName === null) return fail(400, "BAD_REQUEST", "Malformed request.");

  try {
    const { code } = await context.params;
    const { identifyPlayer, joinRoom } = getHttpContainer();
    const player = await identifyPlayer.execute({ playerId: await readSessionPlayerId(), displayName });
    const room = await joinRoom.execute({ code, playerId: player.id });
    return attachSession(NextResponse.json({ code: room.code }), player.id);
  } catch (err) {
    return failFrom(err);
  }
}
