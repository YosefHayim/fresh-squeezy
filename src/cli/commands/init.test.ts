import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeLicenseKeyDoc,
  liveUserDoc,
  publishedDiscountDoc,
  publishedProductDoc,
  storeDoc,
  storesCollection,
  subscriptionVariantDoc,
  userDoc,
  variantsCollectionPublished,
  webhooksCollectionComplete,
} from "../../../tests/fixtures/sandbox/data.js";
import { createMockFetch, pathIs, pathIsWithQuery } from "../../../tests/helpers/mockFetch.js";
import { ENV_KEYS } from "../../core/config.js";
import { runInitCommand } from "./init.js";

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  checkbox: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
}));

type PromptConfig = {
  message?: string;
  theme?: { prefix?: { idle?: string } };
  choices?: Array<{ name?: string }>;
};

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.values(ENV_KEYS)) delete process.env[key];
  Object.assign(process.env, ORIGINAL_ENV);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runInitCommand", () => {
  it("runs every optional doctor validator selected during setup", async () => {
    const webhookUrl = "https://app.example.com/api/webhooks/lemon-squeezy";
    vi.mocked(password).mockResolvedValueOnce("k_test_abc");
    vi.mocked(checkbox)
      .mockResolvedValueOnce(["product", "webhook", "discount", "license-key", "subscription-plan"])
      .mockResolvedValueOnce(["100"])
      .mockResolvedValueOnce([webhookUrl])
      .mockResolvedValueOnce(["600"])
      .mockResolvedValueOnce(["700"])
      .mockResolvedValueOnce(["800"]);
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      {
        match: pathIsWithQuery("/v1/products", { "filter[store_id]": "42" }),
        status: 200,
        body: { data: [publishedProductDoc.data] },
      },
      {
        match: pathIsWithQuery("/v1/discounts", { "filter[store_id]": "42" }),
        status: 200,
        body: { data: [publishedDiscountDoc.data] },
      },
      {
        match: pathIsWithQuery("/v1/license-keys", { "filter[store_id]": "42" }),
        status: 200,
        body: { data: [activeLicenseKeyDoc.data] },
      },
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
        status: 200,
        body: variantsCollectionPublished,
      },
      {
        match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
        status: 200,
        body: webhooksCollectionComplete,
      },
      { match: pathIs("/v1/discounts/600"), status: 200, body: publishedDiscountDoc },
      { match: pathIs("/v1/license-keys/700"), status: 200, body: activeLicenseKeyDoc },
      { match: pathIs("/v1/variants/800"), status: 200, body: subscriptionVariantDoc },
    ]);
    vi.stubGlobal("fetch", fetch);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runInitCommand();

    expect(code).toBe(0);
    const output = stdout.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain(
      "Running doctor (connection, store, product, webhook, discount, licenseKey, subscriptionPlan)",
    );
    expect(output).toContain("fresh-squeezy");
    expect(output).toContain("Guided setup");
    expect(output).toContain("Store Fresh Squeezy Test");
    expect(output).toContain("7 checks passed");
    expect(output).toContain("PASS [test] product");
    expect(output).toContain("PASS [test] webhook");
    expect(output).toContain("PASS [test] discount");
    expect(output).toContain("PASS [test] licenseKey");
    expect(output).toContain("PASS [test] subscriptionPlan");
    expect(output).toContain("Products 1");
    expect(output).toContain("Webhooks 1");

    const allConfigs = [
      ...vi.mocked(password).mock.calls,
      ...vi.mocked(checkbox).mock.calls,
      ...vi.mocked(select).mock.calls,
      ...vi.mocked(confirm).mock.calls,
      ...vi.mocked(input).mock.calls,
    ].map((call) => call[0] as unknown as PromptConfig);
    for (const config of allConfigs) {
      expect(config.theme?.prefix?.idle).toBe("›");
    }
    const productPicker = vi
      .mocked(checkbox)
      .mock.calls.map((call) => call[0] as unknown as PromptConfig)
      .find((config) => config.message === "Pick products to validate:");
    expect(productPicker?.choices?.[0]?.name).toContain("Pro Plan");
    expect(productPicker?.choices?.map((choice) => choice.name)).not.toContain("Enter manually");
    expect(productPicker?.choices?.map((choice) => choice.name)).not.toContain("Skip this check");
  });

  it("keeps manual and skip out of the discovered resource checkbox", async () => {
    vi.mocked(password).mockResolvedValueOnce("k_test_abc");
    vi.mocked(checkbox).mockResolvedValueOnce(["webhook"]).mockResolvedValueOnce([]);
    vi.mocked(select).mockResolvedValueOnce("manual");
    vi.mocked(input).mockResolvedValueOnce("https://custom.example.com/webhook");
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      {
        match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
        status: 200,
        body: webhooksCollectionComplete,
      },
    ]);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runInitCommand();

    expect(code).toBe(1);
    const checkboxConfigs = vi
      .mocked(checkbox)
      .mock.calls.map((call) => call[0] as unknown as PromptConfig);
    const webhookPicker = checkboxConfigs.find(
      (config) => config.message === "Pick webhook URLs to validate:",
    );
    const choiceNames = webhookPicker?.choices?.map((choice) => choice.name);
    expect(choiceNames).not.toContain("Enter manually");
    expect(choiceNames).not.toContain("Skip this check");

    const emptyAction = vi
      .mocked(select)
      .mock.calls.map((call) => call[0] as unknown as PromptConfig)
      .find((config) => config.message === "No webhook URLs selected. What now?");
    expect(emptyAction?.choices?.map((choice) => choice.name)).toEqual([
      "Enter manually",
      "Skip this check",
    ]);
  });

  it("allows multiple discovered resources for one selected check", async () => {
    const secondProductDoc = {
      data: {
        ...publishedProductDoc.data,
        id: "101",
        attributes: {
          ...publishedProductDoc.data.attributes,
          name: "Team Plan",
          slug: "team-plan",
        },
      },
    };

    vi.mocked(password).mockResolvedValueOnce("k_test_abc");
    vi.mocked(checkbox).mockResolvedValueOnce(["product"]).mockResolvedValueOnce(["100", "101"]);
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      {
        match: pathIsWithQuery("/v1/products", { "filter[store_id]": "42" }),
        status: 200,
        body: { data: [publishedProductDoc.data, secondProductDoc.data] },
      },
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
      { match: pathIs("/v1/products/101"), status: 200, body: secondProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
        status: 200,
        body: variantsCollectionPublished,
      },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "101" }),
        status: 200,
        body: variantsCollectionPublished,
      },
    ]);
    vi.stubGlobal("fetch", fetch);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runInitCommand();

    expect(code).toBe(0);
    const output = stdout.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("Running doctor (connection, store, product x2)");
    expect(output).toContain("4 checks passed");
    expect(output.match(/PASS \[test\] product/g)).toHaveLength(2);
  });

  it("uses env API key and auto-detects live mode without prompting for credentials", async () => {
    process.env[ENV_KEYS.apiKey] = "k_live_env";
    vi.mocked(confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(checkbox).mockResolvedValueOnce([]);

    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: liveUserDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
    ]);
    vi.stubGlobal("fetch", fetch);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runInitCommand();

    expect(code).toBe(0);
    const output = stdout.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain(`Using ${ENV_KEYS.apiKey} from environment.`);
    expect(output).toContain("Detected live-mode API key.");
    expect(output).toContain("fresh-squeezy doctor: OK (mode: live)");

    expect(password).not.toHaveBeenCalled();
  });

  it("stops before live-mode setup when the user does not confirm", async () => {
    process.env[ENV_KEYS.apiKey] = "k_live_env";
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: liveUserDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const code = await runInitCommand();

    expect(code).toBe(130);
    const output = stderr.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("cancelled");
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(password).not.toHaveBeenCalled();
    expect(checkbox).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
  });

  it("does not prompt when init runs without a TTY", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const code = await runInitCommand({ isInteractive: false });

    expect(code).toBe(2);
    expect(password).not.toHaveBeenCalled();
    expect(checkbox).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
    const output = stderr.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("requires an interactive terminal");
    expect(output).toContain("fresh-squeezy doctor --all-stores");
  });

  it("preserves unrelated env file entries when writing setup values", async () => {
    const workdir = mkdtempSync(join(tmpdir(), "fresh-squeezy-init-"));
    const envFile = join(workdir, ".env");
    writeFileSync(envFile, "OTHER_SECRET=keep\nLEMON_SQUEEZY_MODE=live\n");

    process.env[ENV_KEYS.apiKey] = "k_test_env";
    vi.mocked(checkbox).mockResolvedValueOnce([]);
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const { fetch } = createMockFetch([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
    ]);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const code = await runInitCommand({ envFile });
      expect(code).toBe(0);

      const written = readFileSync(envFile, "utf8");
      expect(written).toContain("OTHER_SECRET=keep");
      expect(written).toContain(`${ENV_KEYS.apiKey}=k_test_env`);
      expect(written).toContain(`${ENV_KEYS.storeId}=42`);
      expect(written).toContain(`${ENV_KEYS.mode}=test`);
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });
});
