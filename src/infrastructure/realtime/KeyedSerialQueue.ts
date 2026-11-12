/**
 * Runs tasks that share a key strictly one after another, in arrival order,
 * while tasks with different keys run concurrently.
 *
 * Every room command goes through this keyed by room code, so a use case's
 * "load, decide, save" can never interleave with another command for the same
 * room (for example: the guest leaving at the instant the host presses start).
 *
 * In-process only. With more than one realtime node this must become a
 * distributed lock or a per-room owner node.
 */
export class KeyedSerialQueue {
  private readonly tails = new Map<string, Promise<void>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task);

    // The tail never rejects, so one failed task cannot poison the ones queued behind it.
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });

    return result;
  }

  /** Number of keys with work queued or running. */
  get activeKeys(): number {
    return this.tails.size;
  }
}
