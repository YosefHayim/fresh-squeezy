import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	loadEnvironmentFileWhenPresent,
	parseMode,
	readApiKeyFromEnvironment,
	readClientSettings,
} from "./environment.js";

const ORIGINAL_FOLDER = process.cwd();
const SCRATCH_PARENT = join(ORIGINAL_FOLDER, "node_modules", ".cache");
const ENVIRONMENT_FILE_NAME = [".", "env"].join("");

let scratchFolder = "";

beforeEach(() => {
	mkdirSync(SCRATCH_PARENT, { recursive: true });
	scratchFolder = mkdtempSync(join(SCRATCH_PARENT, "environment-test-"));
	process.chdir(scratchFolder);
	vi.stubEnv("LEMON_SQUEEZY_TEST_API_KEY", undefined);
	vi.stubEnv("LEMON_SQUEEZY_LIVE_API_KEY", undefined);
});

afterEach(() => {
	process.chdir(ORIGINAL_FOLDER);
	vi.unstubAllEnvs();
	rmSync(scratchFolder, { recursive: true, force: true });
});

describe("parseMode", () => {
	test("accepts test and live", () => {
		expect(parseMode("test")).toBe("test");
		expect(parseMode("live")).toBe("live");
	});

	test("throws INVALID_MODE naming the bad mode", () => {
		expect(() => parseMode("staging")).toThrowError(
			expect.objectContaining({
				code: "INVALID_MODE",
				message: expect.stringContaining("staging"),
			}),
		);
	});
});

describe("readApiKeyFromEnvironment", () => {
	test("reads the key of the chosen mode", () => {
		vi.stubEnv("LEMON_SQUEEZY_TEST_API_KEY", "test-key");
		vi.stubEnv("LEMON_SQUEEZY_LIVE_API_KEY", "live-key");

		expect(readApiKeyFromEnvironment("test")).toBe("test-key");
		expect(readApiKeyFromEnvironment("live")).toBe("live-key");
	});

	test("trims spaces around the key", () => {
		vi.stubEnv("LEMON_SQUEEZY_TEST_API_KEY", "  spaced-key \n");

		const apiKey = readApiKeyFromEnvironment("test");

		expect(apiKey).toBe("spaced-key");
	});

	test("returns undefined when the key is missing or blank", () => {
		const missingApiKey = readApiKeyFromEnvironment("test");
		vi.stubEnv("LEMON_SQUEEZY_TEST_API_KEY", "   ");
		const blankApiKey = readApiKeyFromEnvironment("test");

		expect(missingApiKey).toBeUndefined();
		expect(blankApiKey).toBeUndefined();
	});
});

describe("loadEnvironmentFileWhenPresent", () => {
	test("loads the API key from an environment file in the working folder", () => {
		const environmentFilePath = join(scratchFolder, ENVIRONMENT_FILE_NAME);
		writeFileSync(
			environmentFilePath,
			"LEMON_SQUEEZY_TEST_API_KEY=from-file\n",
		);

		loadEnvironmentFileWhenPresent();

		expect(readApiKeyFromEnvironment("test")).toBe("from-file");
	});

	test("does nothing when there is no environment file", () => {
		loadEnvironmentFileWhenPresent();

		expect(readApiKeyFromEnvironment("test")).toBeUndefined();
	});
});

describe("readClientSettings", () => {
	test("uses the given API key over the environment", () => {
		vi.stubEnv("LEMON_SQUEEZY_LIVE_API_KEY", "from-environment");

		const settings = readClientSettings({ apiKey: "given", mode: "live" });

		expect(settings.apiKey).toBe("given");
		expect(settings.mode).toBe("live");
	});

	test("reads the API key of the chosen mode from the environment", () => {
		vi.stubEnv("LEMON_SQUEEZY_TEST_API_KEY", "test-key");
		vi.stubEnv("LEMON_SQUEEZY_LIVE_API_KEY", "live-key");

		const testSettings = readClientSettings({ mode: "test" });
		const liveSettings = readClientSettings({ mode: "live" });

		expect(testSettings.apiKey).toBe("test-key");
		expect(liveSettings.apiKey).toBe("live-key");
	});

	test("defaults the mode to test and ignores LEMON_SQUEEZY_MODE", () => {
		vi.stubEnv("LEMON_SQUEEZY_TEST_API_KEY", "test-key");
		vi.stubEnv("LEMON_SQUEEZY_MODE", "live");

		const settings = readClientSettings();

		expect(settings.mode).toBe("test");
	});

	test("takes the store id only from the given settings", () => {
		vi.stubEnv("LEMON_SQUEEZY_STORE_ID", "99");

		const settingsWithStore = readClientSettings({
			apiKey: "k",
			storeId: "42",
		});
		const settingsWithoutStore = readClientSettings({ apiKey: "k" });

		expect(settingsWithStore.storeId).toBe("42");
		expect(settingsWithoutStore.storeId).toBeUndefined();
	});

	test("defaults the base url and fetch, and keeps given ones", () => {
		const givenFetch = vi.fn<typeof fetch>();

		const defaultSettings = readClientSettings({ apiKey: "k" });
		const givenSettings = readClientSettings({
			apiKey: "k",
			baseUrl: "https://example.test",
			fetch: givenFetch,
		});

		expect(defaultSettings.baseUrl).toBe("https://api.lemonsqueezy.com");
		expect(defaultSettings.fetch).toBe(globalThis.fetch);
		expect(givenSettings.baseUrl).toBe("https://example.test");
		expect(givenSettings.fetch).toBe(givenFetch);
	});

	test("throws MISSING_API_KEY naming the key of the chosen mode", () => {
		vi.stubEnv("LEMON_SQUEEZY_TEST_API_KEY", "test-key");

		expect(() => readClientSettings({ mode: "live" })).toThrowError(
			expect.objectContaining({
				code: "MISSING_API_KEY",
				message: expect.stringContaining("LEMON_SQUEEZY_LIVE_API_KEY"),
			}),
		);
	});

	test("throws INVALID_MODE for an unknown mode", () => {
		const readWithBadMode = () =>
			readClientSettings({
				apiKey: "k",
				// @ts-expect-error the test passes a mode outside the union on purpose
				mode: "staging",
			});

		expect(readWithBadMode).toThrowError(
			expect.objectContaining({
				code: "INVALID_MODE",
				message: expect.stringContaining("staging"),
			}),
		);
	});
});
