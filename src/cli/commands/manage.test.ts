import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFetch, pathIs } from "../../../tests/helpers/mockFetch.js";

vi.mock("../prompts.js", () => ({
  pickManageOperation: vi.fn(),
  askParentId: vi.fn(),
  pickBulkTargets: vi.fn(),
  confirmResourceOp: vi.fn(),
  isPromptCancel: (err: unknown) => err instanceof Error && err.name === "ExitPromptError",
}));
vi.mock("../resolveStores.js", () => ({ resolveStores: vi.fn() }));

import {
  askParentId,
  confirmResourceOp,
  pickBulkTargets,
  pickManageOperation,
} from "../prompts.js";
import { resolveStores } from "../resolveStores.js";
import { listManageOperations, renderEquivalentCommand, runManageCommand } from "./manage.js";

const discount = (id: string, code: string) => ({
  type: "discounts",
  id,
  attributes: { store_id: 1, code, name: `n-${code}` },
});
const list = (items: unknown[]) => ({
  data: items,
  meta: { page: { currentPage: 1, lastPage: 1 } },
});

describe("listManageOperations", () => {
  it("offers only destructive id-based ops that have a list", () => {
    const ops = listManageOperations().map((o) => `${o.verb} ${o.resource}`);
    expect(ops).toEqual(
      expect.arrayContaining(["delete discount", "delete webhook", "cancel subscription"]),
    );
    expect(ops).not.toContain("get product");
    expect(ops).not.toContain("create webhook");
  });
});

describe("renderEquivalentCommand", () => {
  const base = { verb: "delete", resource: "discount", mode: "test" as const, total: 3 };

  it("uses --all when everything was picked", () => {
    expect(renderEquivalentCommand({ ...base, storeId: "12", picked: ["1", "2", "3"] })).toBe(
      "fresh-squeezy delete discount --all --store-ids 12 --yes",
    );
  });

  it("uses --ids for a subset and marks live mode", () => {
    expect(
      renderEquivalentCommand({ ...base, mode: "live", storeId: "12", picked: ["2", "3"] }),
    ).toBe("fresh-squeezy delete discount --ids 2,3 --yes --mode live");
  });

  it("carries a parent id for nested lists", () => {
    expect(
      renderEquivalentCommand({
        ...base,
        verb: "refund",
        resource: "subscription-invoice",
        parentId: "9",
        picked: ["1", "2", "3"],
      }),
    ).toBe("fresh-squeezy refund subscription-invoice --all --parent-id 9 --yes");
  });
});

describe("runManageCommand", () => {
  const saved = { key: process.env.LEMON_SQUEEZY_API_KEY, mode: process.env.LEMON_SQUEEZY_MODE };
  let out = "";
  let err = "";

  beforeEach(() => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_MODE = "test";
    out = "";
    err = "";
    vi.spyOn(process.stdout, "write").mockImplementation((c) => {
      out += String(c);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((c) => {
      err += String(c);
      return true;
    });
    vi.mocked(pickManageOperation).mockResolvedValue({ resource: "discount", verb: "delete" });
    vi.mocked(resolveStores).mockResolvedValue({ storeIds: ["1"], skipped: false });
  });

  afterEach(() => {
    if (saved.key === undefined) Reflect.deleteProperty(process.env, "LEMON_SQUEEZY_API_KEY");
    else process.env.LEMON_SQUEEZY_API_KEY = saved.key;
    if (saved.mode === undefined) Reflect.deleteProperty(process.env, "LEMON_SQUEEZY_MODE");
    else process.env.LEMON_SQUEEZY_MODE = saved.mode;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  const stubApi = (items: unknown[]) => {
    const mock = createMockFetch([
      { match: pathIs("/v1/discounts"), status: 200, body: list(items) },
      { match: pathIs("/v1/discounts/1", "DELETE"), status: 200, body: {} },
      { match: pathIs("/v1/discounts/2", "DELETE"), status: 200, body: {} },
    ]);
    vi.stubGlobal("fetch", mock.fetch);
    return mock;
  };

  it("deletes the picked subset after one confirm and prints the equivalent command", async () => {
    const mock = stubApi([discount("1", "AAA"), discount("2", "BBB")]);
    vi.mocked(pickBulkTargets).mockResolvedValue(["2"]);
    vi.mocked(confirmResourceOp).mockResolvedValue(true);

    const code = await runManageCommand();

    expect(code).toBe(0);
    expect(confirmResourceOp).toHaveBeenCalledTimes(1);
    expect(vi.mocked(confirmResourceOp).mock.calls[0][0]).toContain("1 discount");
    expect(
      mock.calls.filter((c) => c.method === "DELETE").map((c) => new URL(c.url).pathname),
    ).toEqual(["/v1/discounts/2"]);
    expect(out).toContain("fresh-squeezy delete discount --ids 2 --yes");
  });

  it("changes nothing when the confirm is declined", async () => {
    const mock = stubApi([discount("1", "AAA")]);
    vi.mocked(pickBulkTargets).mockResolvedValue(["1"]);
    vi.mocked(confirmResourceOp).mockResolvedValue(false);

    const code = await runManageCommand();

    expect(code).toBe(0);
    expect(mock.calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(out).toContain("nothing changed");
  });

  it("reports when there is nothing to manage and never prompts for items", async () => {
    stubApi([]);
    const code = await runManageCommand();
    expect(code).toBe(0);
    expect(out).toContain("No discount items found");
    expect(pickBulkTargets).not.toHaveBeenCalled();
  });

  it("asks for a parent id on nested lists", async () => {
    vi.mocked(pickManageOperation).mockResolvedValue({
      resource: "subscription-invoice",
      verb: "refund",
    });
    vi.mocked(askParentId).mockResolvedValue("9");
    const mock = createMockFetch([
      { match: pathIs("/v1/subscription-invoices"), status: 200, body: list([]) },
    ]);
    vi.stubGlobal("fetch", mock.fetch);

    const code = await runManageCommand();

    expect(code).toBe(0);
    expect(askParentId).toHaveBeenCalledWith("subscription-invoice");
    expect(new URL(mock.calls[0].url).searchParams.get("filter[subscription_id]")).toBe("9");
  });

  it("returns 1 when an item fails", async () => {
    const mock = createMockFetch([
      { match: pathIs("/v1/discounts"), status: 200, body: list([discount("1", "AAA")]) },
      {
        match: pathIs("/v1/discounts/1", "DELETE"),
        status: 404,
        body: { errors: [{ status: "404", code: "not_found", title: "Not found" }] },
      },
    ]);
    vi.stubGlobal("fetch", mock.fetch);
    vi.mocked(pickBulkTargets).mockResolvedValue(["1"]);
    vi.mocked(confirmResourceOp).mockResolvedValue(true);

    expect(await runManageCommand()).toBe(1);
    expect(out).toContain("1 failed");
  });

  it("maps API errors to a readable message and exit 2", async () => {
    vi.stubGlobal(
      "fetch",
      createMockFetch([
        {
          match: pathIs("/v1/discounts"),
          status: 401,
          body: { errors: [{ status: "401", code: "unauthorized", title: "Unauthenticated" }] },
        },
      ]).fetch,
    );

    expect(await runManageCommand()).toBe(2);
    expect(err).toContain("fresh-squeezy:");
  });

  it("lets a prompt cancel propagate so the launcher can exit 130", async () => {
    const cancel = Object.assign(new Error("User force closed"), { name: "ExitPromptError" });
    vi.mocked(pickManageOperation).mockRejectedValue(cancel);
    await expect(runManageCommand()).rejects.toBe(cancel);
  });
});
