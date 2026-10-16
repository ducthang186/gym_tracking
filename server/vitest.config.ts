import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    fileParallelism: false, // các test dùng chung một database
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
