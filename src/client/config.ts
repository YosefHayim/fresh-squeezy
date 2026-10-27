import { freshSqueezyErrorOf } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.lemonsqueezy.com";

const DEFAULT_MODE = "test";

export const ENV_KEYS = {
	apiKey: {
		test: "LEMON_SQUEEZY_TEST_API_KEY",
		live: "LEMON_SQUEEZY_LIVE_API_KEY",
	},
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

const readEnv = (envName: string) => process.env[envName]?.trim();

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
	const modeText = input.mode ?? readEnv(ENV_KEYS.mode) ?? DEFAULT_MODE;
	const mode = parseMode(modeText);
	const apiKeyEnvName = ENV_KEYS.apiKey[mode];
	const apiKey = input.apiKey ?? readEnv(apiKeyEnvName);
	const isApiKeyMissing = !apiKey;
	if (isApiKeyMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_API_KEY",
			message: `No API key provided. Pass \`apiKey\` or set ${apiKeyEnvName}.`,
		});
	}
	return {
		apiKey,
		storeId: input.storeId ?? readEnv(ENV_KEYS.storeId),
		mode,
		baseUrl: input.baseUrl ?? DEFAULT_BASE_URL,
		fetch: input.fetch ?? globalThis.fetch,
	};
};
