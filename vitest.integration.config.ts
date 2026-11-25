import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Integration tests: one real server, one real database, real sockets.
 * They share both, so they run in a single process, one file at a time.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/globalSetup.ts"],
    testTimeout: 30_000,
    // The first run has to start Next and compile routes on demand.
    hookTimeout: 180_000,
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
