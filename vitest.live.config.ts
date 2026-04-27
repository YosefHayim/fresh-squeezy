import { defineConfig } from "vitest/config";

/**
 * Vitest config for live API smoke tests.
 *
 * Why a separate config: the default `vitest.config.ts` excludes `tests/live/**`
 * so unit-test runs do not hit the real API. This config flips that — it ONLY
 * runs `tests/live/**` and is opted into via `npm run test:live`.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/live/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
