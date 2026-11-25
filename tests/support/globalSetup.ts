import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { emptyDatabase, resolveTestDatabaseUrl, testPrisma } from "./testDatabase";

/**
 * Starts one real server for the whole integration suite: the same entry point
 * `npm run dev` uses, so the tests exercise Next, Socket.IO and Prisma together
 * rather than a stand-in.
 */

const PORT = Number(process.env.TEST_PORT ?? 3100);
const ROOT = path.resolve(__dirname, "../..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const READY_TIMEOUT_MS = 120_000;

let server: ChildProcess | undefined;

/** Runs a Node CLI directly rather than through npx, so it behaves the same on Windows and Linux. */
const runNode = (script: string, args: string[], env: Record<string, string>) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

async function waitForServer(baseUrl: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`The test server exited with code ${server.exitCode} before it was ready.`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The test server did not answer on ${baseUrl} within ${READY_TIMEOUT_MS / 1000}s.`);
}

/**
 * Proves the running server is writing to the test database and not to the
 * developer's own. If this is wrong, every later test would quietly operate on
 * real data, so it fails the run here.
 */
async function assertServerUsesTestDatabase(baseUrl: string, databaseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Setup Probe" }),
  });
  if (!response.ok) throw new Error(`Could not create a probe room: ${response.status}`);
  const { code } = (await response.json()) as { code: string };

  const prisma = testPrisma(databaseUrl);
  try {
    const found = await prisma.room.findUnique({ where: { code } });
    if (!found) {
      throw new Error(
        "The server created a room that is not in the test database. It is pointed somewhere else; " +
          "check that TEST_DATABASE_URL reaches the server process.",
      );
    }
    await emptyDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export default async function setup() {
  const databaseUrl = resolveTestDatabaseUrl();
  const baseUrl = `http://localhost:${PORT}`;

  const prismaCli = require.resolve("prisma/build/index.js");
  const migrate = runNode(prismaCli, ["migrate", "deploy"], { DATABASE_URL: databaseUrl });
  if (migrate.status !== 0) {
    throw new Error(
      `Could not migrate the test database.\n${migrate.stdout}${migrate.stderr}\n` +
        'If it does not exist yet, create it once: CREATE DATABASE detective_test OWNER detective;',
    );
  }

  const prisma = testPrisma(databaseUrl);
  await emptyDatabase(prisma);
  await prisma.$disconnect();

  server = spawn(process.execPath, [TSX, "server.ts"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(PORT),
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: "integration-suite-secret-value-long-enough",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  // Kept for diagnosis: a failing run should say what the server said.
  const log: string[] = [];
  server.stdout?.on("data", (chunk: Buffer) => log.push(chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => log.push(chunk.toString()));

  try {
    await waitForServer(baseUrl);
    await assertServerUsesTestDatabase(baseUrl, databaseUrl);
  } catch (error) {
    server.kill();
    throw new Error(`${(error as Error).message}\n--- server output ---\n${log.join("")}`);
  }

  process.env.TEST_BASE_URL = baseUrl;
  process.env.TEST_DATABASE_URL = databaseUrl;

  return async () => {
    server?.kill();
  };
}
