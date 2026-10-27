import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createFreshSqueezyError } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.lemonsqueezy.com";

const DEFAULT_MODE = "test";

const ENVIRONMENT_FILE = ".env";

const API_KEY_VARIABLE_NAMES = {
	test: "LEMON_SQUEEZY_TEST_API_KEY",
	live: "LEMON_SQUEEZY_LIVE_API_KEY",
} as const;

export type Mode = "test" | "live";

export interface FreshSqueezySettings {
	apiKey?: string;
	storeId?: string;
	mode?: Mode;
	baseUrl?: string;
	fetch?: typeof fetch;
}

export interface ClientSettings {
	apiKey: string;
	storeId?: string;
	mode: Mode;
	baseUrl: string;
	fetch: typeof fetch;
}

const trimEnvironmentVariable = (variable: string | undefined) => {
	const trimmedVariable = variable?.trim();
	const isEmpty = trimmedVariable === "";
	return isEmpty ? undefined : trimmedVariable;
};

export const loadEnvironmentFileWhenPresent = () => {
	const isEnvironmentFilePresent = existsSync(ENVIRONMENT_FILE);
	if (isEnvironmentFilePresent) loadEnvFile(ENVIRONMENT_FILE);
};

export const readApiKeyFromEnvironment = (mode: Mode) => {
	const isLiveMode = mode === "live";
	const apiKeyVariable = isLiveMode
		? process.env.LEMON_SQUEEZY_LIVE_API_KEY
		: process.env.LEMON_SQUEEZY_TEST_API_KEY;
	return trimEnvironmentVariable(apiKeyVariable);
};

const isMode = (modeName: string): modeName is Mode =>
	modeName === "test" || modeName === "live";

export const parseMode = (modeName: string): Mode => {
	const isKnownMode = isMode(modeName);
	if (isKnownMode) return modeName;
	throw createFreshSqueezyError({
		code: "INVALID_MODE",
		message: `Mode must be "test" or "live", got "${modeName}".`,
	});
};

export const readClientSettings = (
	givenSettings: FreshSqueezySettings = {},
): ClientSettings => {
	const modeName = givenSettings.mode ?? DEFAULT_MODE;
	const mode = parseMode(modeName);
	const environmentApiKey = readApiKeyFromEnvironment(mode);
	const apiKey = givenSettings.apiKey ?? environmentApiKey;
	const isApiKeyMissing = !apiKey;
	if (isApiKeyMissing) {
		throw createFreshSqueezyError({
			code: "MISSING_API_KEY",
			message: `No API key provided. Pass \`apiKey\` or set ${API_KEY_VARIABLE_NAMES[mode]}.`,
		});
	}
	return {
		apiKey,
		storeId: givenSettings.storeId,
		mode,
		baseUrl: givenSettings.baseUrl ?? DEFAULT_BASE_URL,
		fetch: givenSettings.fetch ?? globalThis.fetch,
	};
};
