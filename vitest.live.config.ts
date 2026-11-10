import { defineConfig } from "vitest/config";
import {
	loadEnvironmentFileWhenPresent,
	type Mode,
	readApiKeyFromEnvironment,
} from "./src/client/environment.js";
import baseVitestConfig from "./vitest.config.js";

loadEnvironmentFileWhenPresent();

const isApiKeySet = (mode: Mode) => {
	const apiKey = readApiKeyFromEnvironment(mode);
	return apiKey != null;
};

const liveApiModes = (["test", "live"] satisfies Mode[]).filter(isApiKeySet);

export default defineConfig({
	...baseVitestConfig,
	test: {
		...baseVitestConfig.test,
		provide: { liveApiModes },
		include: ["e2e/live-api.test.ts"],
	},
});
