import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDoctorCommand } from "../../src/cli/commands/doctor.js";
import { ENV_KEYS } from "../../src/core/config.js";
import { createMockFetch, pathIs, pathIsWithQuery } from "../helpers/mockFetch.js";
import {
  publishedProductDoc,
  storesCollection,
  unauthorizedError,
  userDoc,
  variantsCollectionPublished,
} from "../fixtures/sandbox/data.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env[ENV_KEYS.apiKey] = "k_test_abc";
});

afterEach(() => {
  for (const key of Object.values(ENV_KEYS)) delete process.env[key];
  Object.assign(process.env, ORIGINAL);
  vi.restoreAllMocks();
});

describe("runDoctorCommand", () => {
  it("returns exit code 0 when every validator passes for an explicit store id", async () => {
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: { data: storesCollection.data[0] } },
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
        status: 200,
        body: variantsCollectionPublished,
      },
    ]);
    vi.stubGlobal("fetch", fetch);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runDoctorCommand({
      mode: "test",
      storeIds: ["42"],
      productId: "100",
      json: true,
      isInteractive: false,
    });

    expect(code).toBe(0);
    const firstCall = stdout.mock.calls[0]?.[0];
    const payload = JSON.parse(typeof firstCall === "string" ? firstCall : "{}");
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.reports)).toBe(true);
    expect(payload.reports).toHaveLength(1);
    expect(payload.reports[0].results).toHaveLength(3);
  });

  it("runs against every reachable store when --all-stores is set", async () => {
    const multi = {
      data: [
        { type: "stores", id: "42", attributes: { name: "A", slug: "a" } },
        { type: "stores", id: "43", attributes: { name: "B", slug: "b" } },
      ],
    };
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: multi },
      {
        match: pathIs("/v1/stores/42"),
        status: 200,
        body: { data: multi.data[0] },
      },
      {
        match: pathIs("/v1/stores/43"),
        status: 200,
        body: { data: multi.data[1] },
      },
    ]);
    vi.stubGlobal("fetch", fetch);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runDoctorCommand({
      mode: "test",
      allStores: true,
      json: true,
      isInteractive: false,
    });

    expect(code).toBe(0);
    const payload = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "{}"));
    expect(payload.reports).toHaveLength(2);
  });

  it("falls back to connection-only when non-interactive and no store flag", async () => {
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);
    vi.stubGlobal("fetch", fetch);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runDoctorCommand({ mode: "test", json: true, isInteractive: false });

    expect(code).toBe(0);
    const payload = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "{}"));
    expect(payload.reports).toHaveLength(1);
    expect(payload.reports[0].results).toHaveLength(1);
    expect(payload.reports[0].results[0].name).toBe("connection");
  });

  it("returns exit code 1 when auth fails", async () => {
    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 401, body: unauthorizedError },
    ]);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const code = await runDoctorCommand({ mode: "test", json: true, isInteractive: false });
    expect(code).toBe(1);
  });

  it("returns exit code 2 when config throws (e.g. no API key)", async () => {
    delete process.env[ENV_KEYS.apiKey];
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const code = await runDoctorCommand({ mode: "test", isInteractive: false });
    expect(code).toBe(2);
  });
});
