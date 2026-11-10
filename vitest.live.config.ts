import { defineConfig } from "vitest/config";
import {
	loadEnvironmentFileWhenPresent,
	type Mode,
	readApiKeyFromEnvironment,
} from "./src/client/environment.js";
import unitTestSetup from "./vitest.config.js";

loadEnvironmentFileWhenPresent();

const isApiKeySet = (mode: Mode) => {
	const apiKey = readApiKeyFromEnvironment(mode);
	return apiKey != null;
};

const liveApiModes = (["test", "live"] satisfies Mode[]).filter(isApiKeySet);

export default defineConfig({
	...unitTestSetup,
	test: {
		...unitTestSetup.test,
		provide: { liveApiModes },
		include: ["e2e/live-api.test.ts"],
	},
});
