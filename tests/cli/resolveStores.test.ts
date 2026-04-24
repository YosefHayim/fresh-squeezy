import { describe, expect, it, vi } from "vitest";
import { resolveStores } from "../../src/cli/resolveStores.js";
import type { FreshSqueezyClient } from "../../src/createFreshSqueezy.js";

function stubClient(overrides: Partial<FreshSqueezyClient>): FreshSqueezyClient {
  return {
    mode: "test",
    request: vi.fn(),
    validateConnection: vi.fn(),
    validateStore: vi.fn(),
    validateProduct: vi.fn(),
    validateWebhook: vi.fn(),
    doctor: vi.fn(),
    ...overrides,
  } as FreshSqueezyClient;
}

describe("resolveStores", () => {
  it("prefers --store-ids over anything else", async () => {
    const client = stubClient({});
    const result = await resolveStores(client, {
      storeIds: ["1", "2", "1"],
      isInteractive: true,
    });
    expect(result).toEqual({ storeIds: ["1", "2"], skipped: false });
  });

  it("fetches every reachable store when --all-stores is set", async () => {
    const client = stubClient({
      validateConnection: vi.fn().mockResolvedValue({
        ok: true,
        mode: "test",
        name: "connection",
        issues: [],
        resource: { user: {}, storeCount: 2, storeIds: ["10", "11"] },
      }),
    });
    const result = await resolveStores(client, { allStores: true, isInteractive: false });
    expect(result.storeIds).toEqual(["10", "11"]);
    expect(result.skipped).toBe(false);
  });

  it("returns skipped=true when non-interactive and no flags", async () => {
    const client = stubClient({});
    const result = await resolveStores(client, { isInteractive: false });
    expect(result).toEqual({ storeIds: [], skipped: true });
  });

  it("throws NO_STORES when --all-stores is set but account has none", async () => {
    const client = stubClient({
      validateConnection: vi.fn().mockResolvedValue({
        ok: true,
        mode: "test",
        name: "connection",
        issues: [],
        resource: { user: {}, storeCount: 0, storeIds: [] },
      }),
    });
    await expect(resolveStores(client, { allStores: true, isInteractive: false })).rejects.toMatchObject({
      code: "NO_STORES",
    });
  });
});
