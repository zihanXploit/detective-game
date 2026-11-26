import { NextResponse } from "next/server";
import { getPrisma } from "@/infrastructure/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — for a host's health checks and for deciding whether a
 * release is up. It reports only whether the process can reach its database;
 * nothing here describes the inside of the system to an unauthenticated caller.
 */
export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[health] the database is unreachable", error);
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
