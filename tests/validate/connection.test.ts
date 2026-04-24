import { describe, expect, it } from "vitest";
import { HttpClient } from "../../src/core/http.js";
import { resolveConfig } from "../../src/core/config.js";
import { validateConnection } from "../../src/validate/connection.js";
import { createMockFetch, pathIs } from "../helpers/mockFetch.js";
import {
  liveUserDoc,
  storesCollection,
  unauthorizedError,
  userDoc,
} from "../fixtures/sandbox/data.js";

function makeClient(routes: Parameters<typeof createMockFetch>[0]) {
  const { fetch } = createMockFetch(routes);
  return new HttpClient(resolveConfig({ apiKey: "k", fetch, mode: "test" }));
}

describe("validateConnection", () => {
  it("returns ok when key auths and stores are reachable", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);

    const result = await validateConnection(http, "test");

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("test");
    expect(result.resource?.storeCount).toBe(1);
    expect(result.resource?.storeIds).toEqual(["42"]);
  });

  it("warns when no stores reachable", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: { data: [] } },
    ]);

    const result = await validateConnection(http, "test");

    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("STORE_NOT_FOUND");
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("surfaces AUTH_FAILED on 401", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 401, body: unauthorizedError },
    ]);

    const result = await validateConnection(http, "test");

    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("AUTH_FAILED");
  });

  it("flags MODE_MISMATCH when declared mode differs from meta.test_mode", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: liveUserDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);

    const result = await validateConnection(http, "test");

    expect(result.ok).toBe(false);
    expect(result.resource?.actualMode).toBe("live");
    expect(result.resource?.declaredMode).toBe("test");
    const mismatch = result.issues.find((entry) => entry.code === "MODE_MISMATCH");
    expect(mismatch?.severity).toBe("error");
    expect(mismatch?.context).toMatchObject({ declared: "test", actual: "live" });
  });

  it("passes when declared mode matches meta.test_mode", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: liveUserDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);

    const result = await validateConnection(http, "live");

    expect(result.ok).toBe(true);
    expect(result.resource?.actualMode).toBe("live");
  });

  it("skips mode check when meta.test_mode is absent", async () => {
    const docWithoutMeta = { data: userDoc.data };
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: docWithoutMeta },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);

    const result = await validateConnection(http, "live");

    expect(result.ok).toBe(true);
    expect(result.resource?.actualMode).toBeUndefined();
    expect(result.issues.find((entry) => entry.code === "MODE_MISMATCH")).toBeUndefined();
  });
});
