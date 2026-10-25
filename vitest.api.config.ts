import { defineConfig } from "vitest/config";
import base from "./vitest.config.js";

// Explicit opt-in: the default quality command stays offline and service-free.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    fileParallelism: false,
    include: ["tests/**/*.integration.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
