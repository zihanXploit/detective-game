import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { attachRealtime } from "@/infrastructure/realtime/socketServer";

/**
 * Single-process entry point: Next.js and Socket.IO share one HTTP server and one port,
 * so the session cookie is same-origin for both and there is no CORS to configure.
 */
async function main() {
  const dev = process.env.NODE_ENV !== "production";
  loadEnvConfig(process.cwd(), dev);

  const hostname = process.env.HOSTNAME ?? "localhost";
  const port = Number(process.env.PORT ?? 3000);

  const app = next({ dev, hostname, port });
  const handler = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handler(req, res);
  });
  attachRealtime(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
