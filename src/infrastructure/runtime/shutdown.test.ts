import { describe, expect, it, vi } from "vitest";
import { createShutdown } from "./shutdown";

const parts = (over: Partial<Parameters<typeof createShutdown>[0]> = {}) => {
  const order: string[] = [];
  const exits: number[] = [];
  const base = {
    realtime: {
      close: async () => {
        order.push("realtime");
      },
    },
    httpServer: {
      close: (done: () => void) => {
        order.push("http");
        done();
      },
    },
    database: {
      $disconnect: async () => {
        order.push("database");
      },
    },
    exit: (code: number) => {
      exits.push(code);
    },
    log: () => {},
    onError: () => {},
  };
  return { order, exits, shutDown: createShutdown({ ...base, ...over }) };
};

describe("createShutdown", () => {
  it("closes the sockets, then the server, then the database, and exits cleanly", async () => {
    const { order, exits, shutDown } = parts();
    await shutDown("SIGTERM");

    expect(order).toEqual(["realtime", "http", "database"]);
    expect(exits).toEqual([0]);
  });

  it("ignores a second signal while the first is being honoured", async () => {
    const { order, exits, shutDown } = parts();
    await Promise.all([shutDown("SIGTERM"), shutDown("SIGINT")]);

    expect(order).toEqual(["realtime", "http", "database"]);
    expect(exits).toEqual([0]);
  });

  it("exits with a failure when something will not close", async () => {
    const { exits, shutDown } = parts({
      database: {
        $disconnect: async () => {
          throw new Error("still busy");
        },
      },
    });
    await shutDown("SIGTERM");
    expect(exits).toEqual([1]);
  });

  it("gives up rather than hanging a deploy", async () => {
    vi.useFakeTimers();
    try {
      const { exits, shutDown } = parts({
        realtime: { close: () => new Promise(() => {}) },
        graceMs: 5_000,
      });
      void shutDown("SIGTERM");

      await vi.advanceTimersByTimeAsync(4_999);
      expect(exits).toEqual([]);
      await vi.advanceTimersByTimeAsync(2);
      expect(exits).toEqual([1]);
    } finally {
      vi.useRealTimers();
    }
  });
});
