import { buildFreshSqueezyError } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.lemonsqueezy.com";

const DEFAULT_MODE = "test";

const API_KEY_ENV_NAMES = {
	test: "LEMON_SQUEEZY_TEST_API_KEY",
	live: "LEMON_SQUEEZY_LIVE_API_KEY",
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

const trimEnvText = (envText: string | undefined) => {
	const trimmedText = envText?.trim();
	const isEmpty = trimmedText === "";
	return isEmpty ? undefined : trimmedText;
};

export const readEnvApiKey = (mode: Mode) => {
	const isLiveMode = mode === "live";
	const envApiKey = isLiveMode
		? process.env.LEMON_SQUEEZY_LIVE_API_KEY
		: process.env.LEMON_SQUEEZY_TEST_API_KEY;
	return trimEnvText(envApiKey);
};

const isMode = (modeText: string): modeText is Mode =>
	modeText === "test" || modeText === "live";

export const parseMode = (modeText: string): Mode => {
	const isKnownMode = isMode(modeText);
	if (isKnownMode) return modeText;
	throw buildFreshSqueezyError({
		code: "INVALID_MODE",
		message: `Mode must be "test" or "live", got "${modeText}".`,
	});
};

export const readConfig = (givenConfig: FreshSqueezyConfig = {}): Config => {
	const envMode = trimEnvText(process.env.LEMON_SQUEEZY_MODE);
	const modeText = givenConfig.mode ?? envMode ?? DEFAULT_MODE;
	const mode = parseMode(modeText);
	const envApiKey = readEnvApiKey(mode);
	const apiKey = givenConfig.apiKey ?? envApiKey;
	const isApiKeyMissing = !apiKey;
	if (isApiKeyMissing) {
		throw buildFreshSqueezyError({
			code: "MISSING_API_KEY",
			message: `No API key provided. Pass \`apiKey\` or set ${API_KEY_ENV_NAMES[mode]}.`,
		});
	}
	const envStoreId = trimEnvText(process.env.LEMON_SQUEEZY_STORE_ID);
	return {
		apiKey,
		storeId: givenConfig.storeId ?? envStoreId,
		mode,
		baseUrl: givenConfig.baseUrl ?? DEFAULT_BASE_URL,
		fetch: givenConfig.fetch ?? globalThis.fetch,
	};
};
