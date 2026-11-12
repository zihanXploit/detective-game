import { describe, expect, it } from "vitest";
import { KeyedSerialQueue } from "./KeyedSerialQueue";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("KeyedSerialQueue", () => {
  it("runs tasks for one key in arrival order without overlap", async () => {
    const queue = new KeyedSerialQueue();
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`start ${name}`);
      await pause(ms);
      log.push(`end ${name}`);
    };

    await Promise.all([queue.run("room", task("slow", 30)), queue.run("room", task("fast", 1))]);

    expect(log).toEqual(["start slow", "end slow", "start fast", "end fast"]);
  });

  it("lets different keys run concurrently", async () => {
    const queue = new KeyedSerialQueue();
    const log: string[] = [];

    await Promise.all([
      queue.run("a", async () => {
        await pause(30);
        log.push("a");
      }),
      queue.run("b", async () => {
        log.push("b");
      }),
    ]);

    expect(log).toEqual(["b", "a"]);
  });

  it("keeps going after a task fails and reports the failure to its caller only", async () => {
    const queue = new KeyedSerialQueue();
    const failed = queue.run("room", async () => {
      throw new Error("boom");
    });
    const next = queue.run("room", async () => "fine");

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("fine");
  });

  it("forgets a key once its work is done", async () => {
    const queue = new KeyedSerialQueue();
    await queue.run("room", async () => undefined);
    await pause(0);
    expect(queue.activeKeys).toBe(0);
  });
});
