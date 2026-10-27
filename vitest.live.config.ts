import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "vitest/config";
import { ENV_KEYS, type Mode } from "./src/client/config.js";
import baseConfig from "./vitest.config.js";

const ENV_FILE = ".env";

const MODES: Mode[] = ["test", "live"];

const isEnvFilePresent = existsSync(ENV_FILE);
if (isEnvFilePresent) loadEnvFile(ENV_FILE);

const isApiKeySet = (mode: Mode) => {
	const apiKeyEnvName = ENV_KEYS.apiKey[mode];
	const apiKey = process.env[apiKeyEnvName]?.trim();
	return Boolean(apiKey);
};

const liveSmokeModes = MODES.filter(isApiKeySet);

export default defineConfig({
	...baseConfig,
	test: {
		...baseConfig.test,
		provide: { liveSmokeModes },
		include: ["e2e/live-api.test.ts"],
	},
});
