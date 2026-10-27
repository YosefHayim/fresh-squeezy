import { defineConfig } from "vitest/config";
import {
	loadEnvironmentFileWhenPresent,
	type Mode,
	readApiKeyFromEnvironment,
} from "./src/client/environment.js";
import baseSettings from "./vitest.config.js";

const MODES: Mode[] = ["test", "live"];

loadEnvironmentFileWhenPresent();

const isApiKeySet = (mode: Mode) => {
	const apiKey = readApiKeyFromEnvironment(mode);
	return apiKey !== undefined;
};

const liveApiModes = MODES.filter(isApiKeySet);

export default defineConfig({
	...baseSettings,
	test: {
		...baseSettings.test,
		provide: { liveApiModes },
		include: ["e2e/live-api.test.ts"],
	},
});
