import { describe, expect, it } from "vitest";
import { HttpClient } from "../../src/core/http.js";
import { resolveConfig } from "../../src/core/config.js";
import { validateStore } from "../../src/validate/store.js";
import { createMockFetch, pathIs } from "../helpers/mockFetch.js";
import { notFoundError, storeDoc } from "../fixtures/sandbox/data.js";

function makeClient(routes: Parameters<typeof createMockFetch>[0]) {
  const { fetch } = createMockFetch(routes);
  return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
}

describe("validateStore", () => {
  it("returns ok for reachable store", async () => {
    const http = makeClient([{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc }]);
    const result = await validateStore(http, "test", 42);
    expect(result.ok).toBe(true);
    expect(result.resource?.slug).toBe("fresh-squeezy-test");
  });

  it("returns STORE_NOT_FOUND on 404", async () => {
    const http = makeClient([
      { match: pathIs("/v1/stores/9999"), status: 404, body: notFoundError },
    ]);
    const result = await validateStore(http, "test", 9999);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("STORE_NOT_FOUND");
  });
});
