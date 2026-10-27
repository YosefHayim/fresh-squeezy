import type {
	FreshSqueezyConfig,
	Mode,
	ResolvedConfig,
} from "@/shared/contracts.js";
import { freshSqueezyErrorOf } from "@/shared/errors.js";

const DEFAULT_BASE_URL = "https://api.lemonsqueezy.com";

export const ENV_KEYS = {
	apiKey: "LEMON_SQUEEZY_API_KEY",
	storeId: "LEMON_SQUEEZY_STORE_ID",
	mode: "LEMON_SQUEEZY_MODE",
} as const;

export const readEnvApiKey = () => process.env[ENV_KEYS.apiKey]?.trim();

export const readEnvMode = () => process.env[ENV_KEYS.mode]?.trim();

export const resolveConfig = (
	input: FreshSqueezyConfig = {},
): ResolvedConfig => {
	const apiKey = input.apiKey ?? process.env[ENV_KEYS.apiKey];
	const isApiKeyMissing = !apiKey;
	if (isApiKeyMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_API_KEY",
			message: `No API key provided. Pass \`apiKey\` or set ${ENV_KEYS.apiKey}.`,
		});
	}

	const mode = parseMode(input.mode ?? process.env[ENV_KEYS.mode] ?? "test");
	const storeIdRaw = input.storeId ?? process.env[ENV_KEYS.storeId];

	const isStoreIdMissing = storeIdRaw == null;

	return {
		apiKey,
		storeId: isStoreIdMissing ? undefined : String(storeIdRaw),
		mode,
		baseUrl: input.baseUrl ?? DEFAULT_BASE_URL,
		fetch: input.fetch ?? globalThis.fetch,
	};
};

export const isMode = (value: string): value is Mode =>
	value === "test" || value === "live";

export const parseMode = (value: string): Mode => {
	if (isMode(value)) return value;
	throw freshSqueezyErrorOf({
		code: "INVALID_MODE",
		message: `Mode must be "test" or "live", got "${value}".`,
	});
};
