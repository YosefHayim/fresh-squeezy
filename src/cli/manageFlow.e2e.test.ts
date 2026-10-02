import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFetch, pathIs } from "../../tests/helpers/mockFetch.js";

// Only the inquirer layer and project install are mocked: launcher → menu →
// manage → prompt wrappers → bulk executor → HTTP all run for real.
vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  checkbox: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
}));
vi.mock("./projectInstall.js", () => ({
  ensureFreshSqueezyDevDependency: vi.fn().mockResolvedValue({ status: "skipped" }),
}));
vi.mock("./resolveStores.js", () => ({
  resolveStores: vi.fn().mockResolvedValue({ storeIds: ["1"], skipped: false }),
}));

import { checkbox, confirm, select } from "@inquirer/prompts";
import { runLauncherCommand } from "./commands/launcher.js";

const discount = (id: string, code: string) => ({
  type: "discounts",
  id,
  attributes: { store_id: 1, code, name: `n-${code}` },
});

describe("Manage resources flow (launcher → delete discounts)", () => {
  const saved = { key: process.env.LEMON_SQUEEZY_API_KEY, mode: process.env.LEMON_SQUEEZY_MODE };
  let out = "";

  beforeEach(() => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_MODE = "test";
    out = "";
    vi.spyOn(process.stdout, "write").mockImplementation((c) => {
      out += String(c);
      return true;
    });
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

  it("deletes every discount the user selects and prints the scriptable command", async () => {
    const mock = createMockFetch([
      {
        match: pathIs("/v1/discounts"),
        status: 200,
        body: {
          data: [discount("1", "AAA"), discount("2", "BBB")],
          meta: { page: { currentPage: 1, lastPage: 1 } },
        },
      },
      { match: pathIs("/v1/discounts/1", "DELETE"), status: 200, body: {} },
      { match: pathIs("/v1/discounts/2", "DELETE"), status: 200, body: {} },
    ]);
    vi.stubGlobal("fetch", mock.fetch);

    // 1st select = launcher menu, 2nd = operation picker.
    vi.mocked(select)
      .mockResolvedValueOnce("manage")
      .mockImplementationOnce(async (config) => {
        const choices = (config as { choices: { name: string; value: unknown }[] }).choices;
        return choices.find((c) => c.name === "delete discount")?.value;
      });
    vi.mocked(checkbox).mockResolvedValueOnce(["1", "2"]);
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const code = await runLauncherCommand({ isInteractive: true, install: false });

    expect(code).toBe(0);
    expect(
      mock.calls.filter((c) => c.method === "DELETE").map((c) => new URL(c.url).pathname),
    ).toEqual(["/v1/discounts/1", "/v1/discounts/2"]);
    expect(out).toContain("2/2 succeeded");
    expect(out).toContain("fresh-squeezy delete discount --all --store-ids 1 --yes");
  });
});
