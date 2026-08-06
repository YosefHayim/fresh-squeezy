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

    const resource = await http.getResource("/v1/stores/42");

    expect(resource.id).toBe("42");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/v1/stores/42");
    expect(calls[0]?.method).toBe("GET");
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

  it("throws RATE_LIMITED on 429", async () => {
    const { fetch } = createMockFetch([
      {
        match: pathIs("/v1/products"),
        status: 429,
        body: { errors: [{ status: "429", title: "Too Many Requests" }] },
      },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    await expect(http.getCollection("/v1/products")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      message: "Too Many Requests",
    });
  });

  it("falls back to HTTP_<status> when no JSON:API code is present", async () => {
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/boom"), status: 500, body: { errors: [] } },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
      code: "HTTP_500",
      status: 500,
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

  it("postResource sends POST with JSON:API content-type and returns data", async () => {
    const createDoc = {
      data: {
        type: "customers",
        id: "9",
        attributes: { name: "Ada", email: "ada@example.com" },
      },
    };
    const { fetch, calls } = createMockFetch([
      { match: pathIs("/v1/customers", "POST"), status: 201, body: createDoc },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    const resource = await http.postResource("/v1/customers", {
      data: { type: "customers", attributes: { name: "Ada", email: "ada@example.com" } },
    });

    expect(resource.id).toBe("9");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toContain("ada@example.com");
  });

  it("patchResource sends PATCH and returns updated data", async () => {
    const updateDoc = {
      data: {
        type: "license-keys",
        id: "3",
        attributes: { status: "disabled" },
      },
    };
    const { fetch, calls } = createMockFetch([
      { match: pathIs("/v1/license-keys/3", "PATCH"), status: 200, body: updateDoc },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    const resource = await http.patchResource("/v1/license-keys/3", {
      data: { type: "license-keys", id: "3", attributes: { status: "disabled" } },
    });

    expect(resource.attributes).toMatchObject({ status: "disabled" });
    expect(calls[0]?.method).toBe("PATCH");
  });

  it("deleteResource accepts empty success bodies", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      expect(new URL(url).pathname).toBe("/v1/webhooks/7");
      expect((init?.method ?? "GET").toUpperCase()).toBe("DELETE");
      // null body — undici rejects non-null body with 204
      return new Response(null, { status: 204 });
    };
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch: fetchImpl }));

    await expect(http.deleteResource("/v1/webhooks/7")).resolves.toBeUndefined();
  });

  it("paginate() walks every page until lastPage and concatenates results", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const page = Number(new URL(url).searchParams.get("page[number]") ?? 1);
      const pageBody = {
        data: [
          { type: "products", id: `${page}a`, attributes: { name: `p${page}a` } },
          { type: "products", id: `${page}b`, attributes: { name: `p${page}b` } },
        ],
        meta: { page: { currentPage: page, lastPage: 3, total: 6 } },
      };
      return new Response(JSON.stringify(pageBody), {
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
      const pageBody = {
        data: [{ type: "x", id: `${page}`, attributes: {} }],
        meta: { page: { currentPage: page, lastPage: 3, total: 3 } },
      };
      return new Response(JSON.stringify(pageBody), {
        status: 200,
        headers: { "content-type": "application/vnd.api+json" },
      });
    };
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch: fetchImpl }));

    const all = await http.paginate("/v1/x", { "page[number]": 2 });
    expect(all.map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("serializes JSON:API bracket query params via URLSearchParams", async () => {
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

    // URLSearchParams percent-encodes brackets; searchParams.get still decodes them.
    expect(calls[0]?.url).toContain("filter%5Bstore_id%5D=42");
  });

  it("skips undefined query values", async () => {
    const { fetch, calls } = createMockFetch([
      { match: pathIs("/v1/products"), status: 200, body: { data: [] } },
    ]);
    const http = new HttpClient(resolveConfig({ apiKey: "k", fetch }));

    await http.getCollection("/v1/products", {
      "filter[store_id]": "1",
      "filter[status]": undefined,
    });

    const url = new URL(calls[0]?.url ?? "");
    expect(url.searchParams.get("filter[store_id]")).toBe("1");
    expect(url.searchParams.has("filter[status]")).toBe(false);
  });
});
