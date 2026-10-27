import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const isLiveSmokeEnabled = process.env.LEMON_SQUEEZY_LIVE_SMOKE === "1";
const liveSmokeApiKey = isLiveSmokeEnabled
	? process.env.LEMON_SQUEEZY_API_KEY?.trim()
	: undefined;

const e2eUrl = new URL("./e2e", import.meta.url);
const srcUrl = new URL("./src", import.meta.url);

export default defineConfig({
	resolve: {
		alias: {
			"@e2e": fileURLToPath(e2eUrl),
			"@": fileURLToPath(srcUrl),
		},
	},
	test: {
		globals: false,
		environment: "node",
		unstubEnvs: true,
		provide: { liveSmokeApiKey },
		include: ["e2e/live-smoke.test.ts"],
		exclude: ["node_modules/**", "dist/**"],
	},
});
