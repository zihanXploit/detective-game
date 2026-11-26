/**
 * Closing the service in order, so a deploy does not cut a game off mid-write:
 * stop accepting connections, cut the open sockets, release the database.
 *
 * The pieces are injected rather than imported so the sequence can be tested
 * without a real server, and so that nothing here has to know about Next.
 */

export interface Closable {
  close(): Promise<unknown> | unknown;
}

export interface ShutdownParts {
  /** Socket.IO: closed first, so no command arrives while the rest is going. */
  realtime: Closable;
  /** The HTTP server, whose close takes a callback rather than returning a promise. */
  httpServer: { close(done: () => void): unknown };
  database: { $disconnect(): Promise<unknown> };
  exit: (code: number) => void;
  log?: (message: string) => void;
  onError?: (message: string, error: unknown) => void;
  /** If something refuses to let go, leave anyway rather than hang the deploy. */
  graceMs?: number;
}

export function createShutdown({
  realtime,
  httpServer,
  database,
  exit,
  log = console.log,
  onError = console.error,
  graceMs = 10_000,
}: ShutdownParts) {
  let closing = false;

  return async function shutDown(reason: string): Promise<void> {
    // A second signal while the first is still being honoured changes nothing.
    if (closing) return;
    closing = true;
    log(`> ${reason} received, shutting down`);

    const giveUp = setTimeout(() => {
      onError("> shutdown took too long, exiting anyway", null);
      exit(1);
    }, graceMs);
    // Never let the timer alone keep the process alive.
    if (typeof giveUp === "object" && "unref" in giveUp) giveUp.unref();

    try {
      await realtime.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await database.$disconnect();
      clearTimeout(giveUp);
      log("> closed cleanly");
      exit(0);
    } catch (error) {
      clearTimeout(giveUp);
      onError("> failed to shut down cleanly", error);
      exit(1);
    }
  };
}
