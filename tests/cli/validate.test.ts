import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { ENV_KEYS } from "../../src/core/config.js";
import { createMockFetch, pathIs } from "../helpers/mockFetch.js";
import { storeDoc, storesCollection, userDoc } from "../fixtures/sandbox/data.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env[ENV_KEYS.apiKey] = "k_test_abc";
});

afterEach(() => {
  for (const key of Object.values(ENV_KEYS)) delete process.env[key];
  Object.assign(process.env, ORIGINAL);
  vi.restoreAllMocks();
});

describe("runValidateCommand", () => {
  it("runs the connection validator and exits 0 on success", async () => {
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runValidateCommand("connection", {
      mode: "test",
      json: true,
      isInteractive: false,
    });
    expect(code).toBe(0);
  });

  it("requires --store-ids or --all-stores for `validate store` in non-interactive mode", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runValidateCommand("store", { mode: "test", isInteractive: false });
    expect(code).toBe(2);
  });

  it("runs the store validator per --store-ids entry", async () => {
    const { fetch, calls } = createMockFetch([
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      {
        match: pathIs("/v1/stores/43"),
        status: 200,
        body: { data: { ...storeDoc.data, id: "43" } },
      },
    ]);
    vi.stubGlobal("fetch", fetch);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runValidateCommand("store", {
      mode: "test",
      storeIds: ["42", "43"],
      json: true,
      isInteractive: false,
    });

    expect(code).toBe(0);
    expect(calls.filter((call) => call.url.includes("/v1/stores/"))).toHaveLength(2);
    const payload = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "[]"));
    expect(payload).toHaveLength(2);
  });

  it("resolves every reachable store when --all-stores is passed", async () => {
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
    ]);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runValidateCommand("store", {
      mode: "test",
      allStores: true,
      json: true,
      isInteractive: false,
    });
    expect(code).toBe(0);
  });
});
