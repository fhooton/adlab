import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**"],
      // Coverage floor on the pure domain logic, not a global number.
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
    },
  },
});
