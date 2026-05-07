import { describe, expect, it } from "vitest";
import { HttpClient } from "../../src/core/http.js";
import { fetchActualMode, resolveActualMode } from "../../src/core/mode.js";
import { createMockFetch, pathIs } from "../helpers/mockFetch.js";

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

describe("fetchActualMode", () => {
  it("derives mode from /v1/users/me meta", async () => {
    const { fetch } = createMockFetch([
      {
        match: pathIs("/v1/users/me"),
        status: 200,
        body: { data: { type: "users", id: "1", attributes: { name: "x", email: "x@x" } }, meta: { test_mode: true } },
      },
    ]);
    const http = new HttpClient({
      apiKey: "k",
      mode: "test",
      baseUrl: "https://api.lemonsqueezy.com",
      fetch,
    });

    expect(await fetchActualMode(http)).toBe("test");
  });

  it("returns undefined when the API does not surface meta.test_mode", async () => {
    const { fetch } = createMockFetch([
      {
        match: pathIs("/v1/users/me"),
        status: 200,
        body: { data: { type: "users", id: "1", attributes: { name: "x", email: "x@x" } } },
      },
    ]);
    const http = new HttpClient({
      apiKey: "k",
      mode: "live",
      baseUrl: "https://api.lemonsqueezy.com",
      fetch,
    });

    expect(await fetchActualMode(http)).toBeUndefined();
  });
});
