import { afterEach, expect, test } from "vitest";
import { ENV_KEYS, resolveConfig } from "./config.js";
import { isFreshSqueezyError } from "./errors.js";

const ORIGINAL = { ...process.env };

afterEach(() => {
  for (const key of Object.values(ENV_KEYS)) delete process.env[key];
  Object.assign(process.env, ORIGINAL);
});

test("resolveConfig uses explicit argument over env vars", () => {
  process.env[ENV_KEYS.apiKey] = "from-env";
  const resolved = resolveConfig({ apiKey: "from-arg", mode: "live" });
  expect(resolved.apiKey).toBe("from-arg");
  expect(resolved.mode).toBe("live");
});

test("resolveConfig falls back to env vars when no argument passed", () => {
  process.env[ENV_KEYS.apiKey] = "from-env";
  process.env[ENV_KEYS.mode] = "live";
  process.env[ENV_KEYS.storeId] = "42";
  const resolved = resolveConfig();
  expect(resolved.apiKey).toBe("from-env");
  expect(resolved.mode).toBe("live");
  expect(resolved.storeId).toBe("42");
});

test("resolveConfig defaults mode to test when nothing is set", () => {
  process.env[ENV_KEYS.apiKey] = "k";
  delete process.env[ENV_KEYS.mode];
  expect(resolveConfig().mode).toBe("test");
});

test("resolveConfig throws MISSING_API_KEY when no key is provided", () => {
  delete process.env[ENV_KEYS.apiKey];
  expect(() => resolveConfig()).toThrowError(
    expect.objectContaining({ code: "MISSING_API_KEY" }),
  );
});

test("resolveConfig throws INVALID_MODE for unknown mode", () => {
  expect(() => resolveConfig({ apiKey: "k", mode: "staging" as never })).toThrowError(
    /INVALID_MODE|Mode must be/i,
  );
});

test("resolveConfig coerces numeric storeId to string and defaults baseUrl", () => {
  const resolved = resolveConfig({ apiKey: "k", storeId: 42 });
  expect(resolved.storeId).toBe("42");
  expect(resolved.baseUrl).toBe("https://api.lemonsqueezy.com");
});

test("resolveConfig surfaces INVALID_MODE with the bad value in the message", () => {
  let thrown: unknown;
  try {
    resolveConfig({ apiKey: "k", mode: "staging" as never });
  } catch (error) {
    thrown = error;
  }
  expect(isFreshSqueezyError(thrown)).toBe(true);
  expect((thrown as { code: string; message: string }).code).toBe("INVALID_MODE");
  expect((thrown as { code: string; message: string }).message).toContain("staging");
});
