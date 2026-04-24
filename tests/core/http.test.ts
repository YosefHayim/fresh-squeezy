import { describe, expect, it } from "vitest";
import { HttpClient } from "../../src/core/http.js";
import { FreshSqueezyError } from "../../src/core/errors.js";
import { resolveConfig } from "../../src/core/config.js";
import { createMockFetch, pathIs } from "../helpers/mockFetch.js";
import { storeDoc, unauthorizedError } from "../fixtures/sandbox/data.js";

describe("HttpClient", () => {
  it("sends bearer auth and returns parsed JSON", async () => {
    const { fetch, calls } = createMockFetch([
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k_test_abc", fetch }));

    const result = await http.getResource("/v1/stores/42");

    expect(result.id).toBe("42");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/v1/stores/42");
  });

  it("throws FreshSqueezyError with UNAUTHORIZED on 401", async () => {
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 401, body: unauthorizedError },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "bad", fetch }));

    await expect(http.request({ path: "/v1/users/me" })).rejects.toMatchObject({
      name: "FreshSqueezyError",
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("throws NOT_FOUND on 404 and preserves JSON:API detail", async () => {
    const { fetch } = createMockFetch([
      {
        match: pathIs("/v1/stores/9999"),
        status: 404,
        body: { errors: [{ status: "404", code: "not_found", detail: "Store gone" }] },
      },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    await expect(http.getResource("/v1/stores/9999")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Store gone",
    });
  });

  it("maps network failures to NETWORK_ERROR", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("ECONNRESET");
    };
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch: fetchImpl }));

    const err = await http.request({ path: "/v1/users/me" }).catch((error) => error);
    expect(err).toBeInstanceOf(FreshSqueezyError);
    expect((err as FreshSqueezyError).code).toBe("NETWORK_ERROR");
  });

  it("serializes JSON:API bracket query params without encoding the brackets", async () => {
    const { fetch, calls } = createMockFetch([
      {
        match: ({ method, url }) =>
          method === "GET" &&
          new URL(url).pathname === "/v1/products" &&
          new URL(url).searchParams.get("filter[store_id]") === "42",
        status: 200,
        body: { data: [] },
      },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    await http.getCollection("/v1/products", { "filter[store_id]": "42" });

    expect(calls[0]?.url).toContain("filter%5Bstore_id%5D=42");
  });
});
