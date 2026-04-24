import type { FreshSqueezyConfig, Mode, ResolvedConfig } from "./types.js";
import { FreshSqueezyError } from "./errors.js";

/**
 * Lemon Squeezy API root. Test and live share the same host — mode is determined
 * by which API key is used. Documented at https://docs.lemonsqueezy.com/api.
 */
const DEFAULT_BASE_URL = "https://api.lemonsqueezy.com";

/**
 * Env variable names read when a field is not passed explicitly. Consuming
 * products rely on these names being stable — treat them as public API.
 */
export const ENV_KEYS = {
  apiKey: "LEMON_SQUEEZY_API_KEY",
  storeId: "LEMON_SQUEEZY_STORE_ID",
  mode: "LEMON_SQUEEZY_MODE",
} as const;

/**
 * Resolve the user-supplied config against environment variables and defaults.
 *
 * Precedence (highest → lowest): explicit argument → env var → built-in default.
 * Throws `FreshSqueezyError` only for fields that cannot be defaulted (currently
 * just `apiKey`), so callers can surface a clear setup error at construction
 * time rather than at first request.
 */
export function resolveConfig(input: FreshSqueezyConfig = {}): ResolvedConfig {
  const apiKey = input.apiKey ?? process.env[ENV_KEYS.apiKey];
  if (!apiKey) {
    throw new FreshSqueezyError({
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
}

function normalizeMode(value: string): Mode {
  if (value === "test" || value === "live") return value;
  throw new FreshSqueezyError({
    code: "INVALID_MODE",
    message: `Mode must be "test" or "live", got "${value}".`,
  });
}
