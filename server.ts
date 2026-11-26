import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { getPrisma } from "@/infrastructure/db/prisma";
import { attachRealtime } from "@/infrastructure/realtime/socketServer";
import { createShutdown } from "@/infrastructure/runtime/shutdown";

/**
 * Single-process entry point: Next.js and Socket.IO share one HTTP server and one port,
 * so the session cookie is same-origin for both and there is no CORS to configure.
 *
 * This needs a host that keeps a process alive. It cannot run on a serverless
 * platform, because the WebSocket connections and the in-memory presence,
 * ordering and rate limiting all belong to one long-lived process.
 */
async function main() {
  const dev = process.env.NODE_ENV !== "production";
  loadEnvConfig(process.cwd(), dev);

  const port = Number(process.env.PORT ?? 3000);
  // In a container the service has to listen on every interface, not just loopback.
  const host = process.env.HOST ?? (dev ? "localhost" : "0.0.0.0");

  const app = next({ dev, hostname: host, port });
  const handler = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handler(req, res);
  });
  const io = attachRealtime(httpServer);

  const shutDown = createShutdown({
    realtime: io,
    httpServer,
    database: getPrisma(),
    exit: (code) => process.exit(code),
  });
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => void shutDown(signal));
  }

  httpServer.listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
