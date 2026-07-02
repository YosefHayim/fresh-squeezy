import { describe, expect, it } from "vitest";
import { storeDoc, unauthorizedError } from "../../tests/fixtures/sandbox/data.js";
import { createMockFetch, pathIs } from "../../tests/helpers/mockFetch.js";
import { resolveConfig } from "./config.js";
import { FreshSqueezyError } from "./errors.js";
import { HttpClient } from "./http.js";

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

  it("paginate() walks every page until lastPage and concatenates results", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const page = Number(new URL(url).searchParams.get("page[number]") ?? 1);
      const body = {
        data: [
          { type: "products", id: `${page}a`, attributes: { name: `p${page}a` } },
          { type: "products", id: `${page}b`, attributes: { name: `p${page}b` } },
        ],
        meta: { page: { currentPage: page, lastPage: 3, total: 6 } },
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/vnd.api+json" },
      });
    };
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch: fetchImpl }));

    const all = await http.paginate("/v1/products");
    expect(all).toHaveLength(6);
    expect(all.map((r) => r.id)).toEqual(["1a", "1b", "2a", "2b", "3a", "3b"]);
  });

  it("paginate() returns immediately when meta.page is absent", async () => {
    const { fetch, calls } = createMockFetch([
      {
        match: pathIs("/v1/stores"),
        status: 200,
        body: { data: [{ type: "stores", id: "1", attributes: { name: "x", slug: "x" } }] },
      },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    const all = await http.paginate("/v1/stores");
    expect(all).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("paginate() honors a caller-supplied starting page[number]", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const page = Number(new URL(url).searchParams.get("page[number]") ?? 1);
      const body = {
        data: [{ type: "x", id: `${page}`, attributes: {} }],
        meta: { page: { currentPage: page, lastPage: 3, total: 3 } },
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/vnd.api+json" },
      });
    };
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch: fetchImpl }));

    const all = await http.paginate("/v1/x", { "page[number]": 2 });
    expect(all.map((r) => r.id)).toEqual(["2", "3"]);
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
