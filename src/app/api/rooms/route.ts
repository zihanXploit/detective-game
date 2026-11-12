import { NextResponse } from "next/server";
import { getHttpContainer } from "@/infrastructure/container";
import { fail, failFrom, isRateLimited, readPlayerName } from "@/infrastructure/http/respond";
import { attachSession, readSessionPlayerId } from "@/infrastructure/http/session";

export const runtime = "nodejs";

/** POST /api/rooms — create a room and seat the caller as host. */
export async function POST(request: Request) {
  if (isRateLimited(request, "create")) {
    return fail(429, "RATE_LIMITED", "Too many rooms created. Wait a minute and try again.");
  }
  const displayName = await readPlayerName(request);
  if (displayName === null) return fail(400, "BAD_REQUEST", "Malformed request.");

  try {
    const { identifyPlayer, createRoom } = getHttpContainer();
    const player = await identifyPlayer.execute({ playerId: await readSessionPlayerId(), displayName });
    const room = await createRoom.execute({ hostId: player.id });
    return attachSession(NextResponse.json({ code: room.code }, { status: 201 }), player.id);
  } catch (err) {
    return failFrom(err);
  }
}
