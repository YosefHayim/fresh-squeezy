import { expect, test, vi } from "vitest";
import { isFreshSqueezyError } from "@/shared/errors.js";
import { ENV_KEYS, readConfig } from "./config.js";

test("readConfig uses explicit argument over env vars", () => {
	vi.stubEnv(ENV_KEYS.apiKey, "from-env");
	const config = readConfig({ apiKey: "from-arg", mode: "live" });
	expect(config.apiKey).toBe("from-arg");
	expect(config.mode).toBe("live");
});

test("readConfig falls back to env vars when no argument passed", () => {
	vi.stubEnv(ENV_KEYS.apiKey, "from-env");
	vi.stubEnv(ENV_KEYS.mode, "live");
	vi.stubEnv(ENV_KEYS.storeId, "42");
	const config = readConfig();
	expect(config.apiKey).toBe("from-env");
	expect(config.mode).toBe("live");
	expect(config.storeId).toBe("42");
});

test("readConfig defaults mode to test when nothing is set", () => {
	vi.stubEnv(ENV_KEYS.apiKey, "k");
	vi.stubEnv(ENV_KEYS.mode, undefined);
	expect(readConfig().mode).toBe("test");
});

test("readConfig throws MISSING_API_KEY when no key is provided", () => {
	vi.stubEnv(ENV_KEYS.apiKey, undefined);
	expect(() => readConfig()).toThrowError(
		expect.objectContaining({ code: "MISSING_API_KEY" }),
	);
});

test("readConfig throws INVALID_MODE for unknown mode", () => {
	expect(() =>
		readConfig({ apiKey: "k", mode: "staging" as never }),
	).toThrowError(/INVALID_MODE|Mode must be/i);
});

test("readConfig defaults baseUrl and keeps the storeId", () => {
	const config = readConfig({ apiKey: "k", storeId: "42" });
	expect(config.storeId).toBe("42");
	expect(config.baseUrl).toBe("https://api.lemonsqueezy.com");
});

test("readConfig surfaces INVALID_MODE with the bad value in the message", () => {
	let thrown: unknown;
	try {
		readConfig({ apiKey: "k", mode: "staging" as never });
	} catch (error) {
		thrown = error;
	}
	expect(isFreshSqueezyError(thrown)).toBe(true);
	expect((thrown as { code: string; message: string }).code).toBe(
		"INVALID_MODE",
	);
	expect((thrown as { code: string; message: string }).message).toContain(
		"staging",
	);
});
