import { PrismaClient } from "@prisma/client";

/**
 * The integration suite wipes whatever database it is pointed at, so the
 * address is checked before anything connects. A name without "test" in it,
 * or the same address the app is configured with, stops the run.
 */
export function resolveTestDatabaseUrl(): string {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://detective:detective@localhost:5432/detective_test?schema=public";

  const databaseName = new URL(url).pathname.replace(/^\//, "");
  if (!databaseName.includes("test")) {
    throw new Error(
      `Refusing to run integration tests against "${databaseName}": the database name must contain "test".`,
    );
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error("Refusing to run integration tests against the same database the app uses.");
  }
  return url;
}

export function testPrisma(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

/** Empties every table. Rooms cascade to members and sessions; players are separate. */
export async function emptyDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "game_sessions", "room_members", "rooms", "players" RESTART IDENTITY CASCADE',
  );
}
