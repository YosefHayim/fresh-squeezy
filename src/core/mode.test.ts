import { describe, expect, it } from "vitest";
import { resolveActualMode } from "./mode.js";

describe("resolveActualMode", () => {
  it("returns 'test' when test_mode is true", () => {
    expect(resolveActualMode(true)).toBe("test");
  });

  it("returns 'live' when test_mode is false", () => {
    expect(resolveActualMode(false)).toBe("live");
  });

  it("returns undefined when test_mode is missing", () => {
    expect(resolveActualMode(undefined)).toBeUndefined();
  });
});
