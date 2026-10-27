import { freshSqueezyErrorOf } from "./errors.js";
import type { FreshSqueezyConfig, Mode, ResolvedConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.lemonsqueezy.com";

export const ENV_KEYS = {
  apiKey: "LEMON_SQUEEZY_API_KEY",
  storeId: "LEMON_SQUEEZY_STORE_ID",
  mode: "LEMON_SQUEEZY_MODE",
} as const;

export const resolveConfig = (input: FreshSqueezyConfig = {}): ResolvedConfig => {
  const apiKey = input.apiKey ?? process.env[ENV_KEYS.apiKey];
  if (!apiKey) {
    throw freshSqueezyErrorOf({
      code: "MISSING_API_KEY",
      message: `No API key provided. Pass \`apiKey\` or set ${ENV_KEYS.apiKey}.`,
    });
  }

  const mode = normalizeMode(input.mode ?? process.env[ENV_KEYS.mode] ?? "test");
  const storeIdRaw = input.storeId ?? process.env[ENV_KEYS.storeId];

  return {
    apiKey,
    storeId: storeIdRaw == null ? undefined : String(storeIdRaw),
    mode,
    baseUrl: input.baseUrl ?? DEFAULT_BASE_URL,
    fetch: input.fetch ?? globalThis.fetch,
  };
};

const normalizeMode = (value: string): Mode => {
  if (value === "test" || value === "live") return value;
  throw freshSqueezyErrorOf({
    code: "INVALID_MODE",
    message: `Mode must be "test" or "live", got "${value}".`,
  });
};
