import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "vitest/config";
import { type Mode, readEnvApiKey } from "./src/client/config.js";
import baseConfig from "./vitest.config.js";

const ENV_FILE = ".env";

const MODES: Mode[] = ["test", "live"];

const isEnvFilePresent = existsSync(ENV_FILE);
if (isEnvFilePresent) loadEnvFile(ENV_FILE);

const isApiKeySet = (mode: Mode) => {
	const apiKey = readEnvApiKey(mode);
	return apiKey !== undefined;
};

const liveApiModes = MODES.filter(isApiKeySet);

export default defineConfig({
	...baseConfig,
	test: {
		...baseConfig.test,
		provide: { liveApiModes },
		include: ["e2e/live-api.test.ts"],
	},
});
