import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.js";

const isLiveSmokeEnabled = process.env.LEMON_SQUEEZY_LIVE_SMOKE === "1";
const liveSmokeApiKey = isLiveSmokeEnabled
	? process.env.LEMON_SQUEEZY_API_KEY?.trim()
	: undefined;

export default defineConfig({
	...baseConfig,
	test: {
		...baseConfig.test,
		provide: { liveSmokeApiKey },
		include: ["e2e/live-smoke.test.ts"],
	},
});
