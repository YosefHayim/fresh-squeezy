import { freshSqueezyErrorOf } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.lemonsqueezy.com";

const DEFAULT_MODE = "test";

export const ENV_KEYS = {
	apiKey: "LEMON_SQUEEZY_API_KEY",
	storeId: "LEMON_SQUEEZY_STORE_ID",
	mode: "LEMON_SQUEEZY_MODE",
} as const;

export type Mode = "test" | "live";

export interface FreshSqueezyConfig {
	apiKey?: string;
	storeId?: string;
	mode?: Mode;
	baseUrl?: string;
	fetch?: typeof fetch;
}

export interface Config {
	apiKey: string;
	storeId?: string;
	mode: Mode;
	baseUrl: string;
	fetch: typeof fetch;
}

const readEnv = (key: keyof typeof ENV_KEYS) => {
	const envName = ENV_KEYS[key];
	return process.env[envName]?.trim();
};

const isMode = (value: string): value is Mode =>
	value === "test" || value === "live";

export const parseMode = (value: string): Mode => {
	const isKnownMode = isMode(value);
	if (isKnownMode) return value;
	throw freshSqueezyErrorOf({
		code: "INVALID_MODE",
		message: `Mode must be "test" or "live", got "${value}".`,
	});
};

export const readConfig = (input: FreshSqueezyConfig = {}): Config => {
	const apiKey = input.apiKey ?? readEnv("apiKey");
	const isApiKeyMissing = !apiKey;
	if (isApiKeyMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_API_KEY",
			message: `No API key provided. Pass \`apiKey\` or set ${ENV_KEYS.apiKey}.`,
		});
	}
	const modeText = input.mode ?? readEnv("mode") ?? DEFAULT_MODE;
	return {
		apiKey,
		storeId: input.storeId ?? readEnv("storeId"),
		mode: parseMode(modeText),
		baseUrl: input.baseUrl ?? DEFAULT_BASE_URL,
		fetch: input.fetch ?? globalThis.fetch,
	};
};
