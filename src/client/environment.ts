import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createFreshSqueezyError } from "./errors.js";

export const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com";

const ENVIRONMENT_FILE = ".env";

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
	const trimmedVariable = variable?.trim() ?? null;
	const isEmpty = trimmedVariable === "";
	return isEmpty ? null : trimmedVariable;
};

export const loadEnvironmentFileWhenPresent = () => {
	const isEnvironmentFilePresent = existsSync(ENVIRONMENT_FILE);
	if (isEnvironmentFilePresent) loadEnvFile(ENVIRONMENT_FILE);
};

export const readApiKeyFromEnvironment = (mode: Mode) => {
	const isLiveMode = mode === "live";
	if (isLiveMode) {
		return trimEnvironmentVariable(process.env.LEMON_SQUEEZY_LIVE_API_KEY);
	}

	return trimEnvironmentVariable(process.env.LEMON_SQUEEZY_TEST_API_KEY);
};

const pickApiKeyVariableName = (mode: Mode) => {
	const isLiveMode = mode === "live";
	if (isLiveMode) return "LEMON_SQUEEZY_LIVE_API_KEY";

	return "LEMON_SQUEEZY_TEST_API_KEY";
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
	const modeName = givenSettings.mode ?? "test";
	const mode = parseMode(modeName);
	const environmentApiKey = readApiKeyFromEnvironment(mode);
	const apiKey = givenSettings.apiKey ?? environmentApiKey;

	const isApiKeyMissing = apiKey == null || apiKey === "";
	if (isApiKeyMissing) {
		const apiKeyVariableName = pickApiKeyVariableName(mode);
		throw createFreshSqueezyError({
			code: "MISSING_API_KEY",
			message: `No API key provided. Pass \`apiKey\` or set ${apiKeyVariableName}.`,
		});
	}

	return {
		apiKey,
		storeId: givenSettings.storeId,
		mode,
		baseUrl: givenSettings.baseUrl ?? LEMON_SQUEEZY_API_URL,
		fetch: givenSettings.fetch ?? globalThis.fetch,
	};
};
