import { describe, expect, test } from "vitest";
import { createFreshSqueezy } from "@/create-fresh-squeezy.js";

const enabled =
	process.env.LEMON_SQUEEZY_LIVE_SMOKE === "1" &&
	Boolean(process.env.LEMON_SQUEEZY_API_KEY);

describe.runIf(enabled)("live smoke", () => {
	test("authenticates and lists stores against the real API", async () => {
		const lemon = createFreshSqueezy();
		const result = await lemon.validateConnection();
		expect(result.ok).toBe(true);
		expect(result.resource?.storeCount).toBeGreaterThan(0);
	}, 15_000);
});
