import { afterEach, describe, expect, it } from "vitest";
import { ENV_KEYS, resolveConfig } from "../../src/core/config.js";
import { FreshSqueezyError } from "../../src/core/errors.js";

const ORIGINAL = { ...process.env };

afterEach(() => {
  for (const key of Object.values(ENV_KEYS)) delete process.env[key];
  Object.assign(process.env, ORIGINAL);
});

describe("resolveConfig", () => {
  it("uses explicit argument over env vars", () => {
    process.env[ENV_KEYS.apiKey] = "from-env";
    const resolved = resolveConfig({ apiKey: "from-arg", mode: "live" });
    expect(resolved.apiKey).toBe("from-arg");
    expect(resolved.mode).toBe("live");
  });

  it("falls back to env vars when no argument passed", () => {
    process.env[ENV_KEYS.apiKey] = "from-env";
    process.env[ENV_KEYS.mode] = "live";
    process.env[ENV_KEYS.storeId] = "42";
    const resolved = resolveConfig();
    expect(resolved.apiKey).toBe("from-env");
    expect(resolved.mode).toBe("live");
    expect(resolved.storeId).toBe("42");
  });

  it("defaults mode to test when nothing is set", () => {
    process.env[ENV_KEYS.apiKey] = "k";
    delete process.env[ENV_KEYS.mode];
    expect(resolveConfig().mode).toBe("test");
  });

  it("throws MISSING_API_KEY when no key is provided", () => {
    delete process.env[ENV_KEYS.apiKey];
    expect(() => resolveConfig()).toThrowError(FreshSqueezyError);
  });

  it("throws INVALID_MODE for unknown mode", () => {
    expect(() => resolveConfig({ apiKey: "k", mode: "staging" as never })).toThrowError(
      /INVALID_MODE|Mode must be/i
    );
  });
});
