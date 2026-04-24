import { describe, expect, it } from "vitest";
import { createFreshSqueezy } from "../../src/createFreshSqueezy.js";

/**
 * Opt-in live smoke test. Runs only when LEMON_SQUEEZY_LIVE_SMOKE=1 is set
 * in the environment. Exercises the real API against the caller's key so we
 * detect platform drift on a schedule (see .github/workflows/live-smoke.yml).
 *
 * This file is excluded from the default `vitest run` via vitest.config.ts.
 */

const enabled = process.env.LEMON_SQUEEZY_LIVE_SMOKE === "1";

describe.runIf(enabled)("live smoke", () => {
  it("authenticates and lists stores against the real API", async () => {
    const lemon = createFreshSqueezy();
    const result = await lemon.validateConnection();
    expect(result.ok).toBe(true);
    expect(result.resource?.storeCount).toBeGreaterThan(0);
  }, 15_000);
});
