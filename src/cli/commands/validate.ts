import { FreshSqueezyError } from "../../core/errors.js";
import type { Mode, ValidationResult } from "../../core/types.js";
import { type FreshSqueezyClient, createFreshSqueezy } from "../../createFreshSqueezy.js";
import { MISSING_API_KEY_HINTS, renderCliError, renderResult } from "../render.js";
import { resolveStores } from "../resolveStores.js";

export interface ValidateCommandOptions {
  mode?: Mode;
  storeIds?: string[];
  allStores?: boolean;
  productId?: string;
  webhookUrl?: string;
  discountId?: string;
  licenseKeyId?: string;
  variantId?: string;
  json?: boolean;
  isInteractive?: boolean;
}

/** Everything one `fresh-squeezy validate <target>` subcommand needs: flags, help, hints, and the run. */
export interface ValidateTargetSpec {
  description: string;
  /** `multi`: `--store-ids` + `--all-stores`, one result per store. `ownership`: first `--store-ids` is cross-checked. */
  stores: "none" | "multi" | "ownership";
  storeIdsHelp?: string;
  /** The resource id flag commander requires, and its help text. */
  required?: [flag: string, description: string];
  examples: string[];
  run: (
    client: FreshSqueezyClient,
    options: ValidateCommandOptions,
  ) => Promise<ValidationResult | ValidationResult[]>;
}

const EXAMPLE_WEBHOOK_URL = "https://app.example.com/api/webhooks/lemon-squeezy";

const required = <T>(value: T | undefined, message: string): T => {
  if (value === undefined || value === null || value === "") {
    throw new FreshSqueezyError({ code: "MISSING_ARG", message });
  }
  return value;
};

const requiredStoreId = (options: ValidateCommandOptions, target: string): string =>
  required(options.storeIds?.[0], `--store-ids is required for \`validate ${target}\`.`);

/** Flag → TTY pick; non-interactive runs without a store flag fail instead of guessing. */
const resolveStoresForTarget = async (
  client: FreshSqueezyClient,
  target: string,
  options: ValidateCommandOptions,
): Promise<string[]> => {
  const resolved = await resolveStores(client, {
    storeIds: options.storeIds,
    allStores: options.allStores,
    isInteractive: options.isInteractive ?? false,
  });
  if (resolved.skipped) {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: `--store-ids or --all-stores is required for \`validate ${target}\` in non-interactive mode.`,
    });
  }
  return resolved.storeIds;
};

/** The `validate` subcommands, in the order `fresh-squeezy validate --help` lists them. */
export const VALIDATE_TARGETS = {
  connection: {
    description: "Check that the API key authenticates",
    stores: "none",
    examples: ["fresh-squeezy validate connection"],
    run: (client) => client.validateConnection(),
  },
  store: {
    description: "Check one or more stores are reachable",
    stores: "multi",
    storeIdsHelp: "Comma-separated store IDs",
    examples: [
      "fresh-squeezy validate store --store-ids 12",
      "fresh-squeezy validate store --all-stores",
    ],
    run: async (client, options) => {
      const storeIds = await resolveStoresForTarget(client, "store", options);
      return Promise.all(storeIds.map((storeId) => client.validateStore(storeId)));
    },
  },
  product: {
    description: "Check a product is published with at least one variant",
    stores: "ownership",
    required: ["--product-id <id>", "Product ID to validate"],
    storeIdsHelp: "Expected owning store IDs (first is used for cross-check)",
    examples: ["fresh-squeezy validate product --product-id 987"],
    run: (client, options) =>
      client.validateProduct({
        productId: required(options.productId, "--product-id is required for `validate product`."),
        expectedStoreId: options.storeIds?.[0],
      }),
  },
  webhook: {
    description: "Check a webhook is registered with the recommended events",
    stores: "multi",
    required: ["--webhook-url <url>", "Public webhook URL"],
    storeIdsHelp: "Comma-separated store IDs",
    examples: [
      `fresh-squeezy validate webhook --store-ids 12 --webhook-url ${EXAMPLE_WEBHOOK_URL}`,
      `fresh-squeezy validate webhook --all-stores --webhook-url ${EXAMPLE_WEBHOOK_URL}`,
    ],
    run: async (client, options) => {
      const storeIds = await resolveStoresForTarget(client, "webhook", options);
      const url = required(options.webhookUrl, "--webhook-url is required for `validate webhook`.");
      return Promise.all(storeIds.map((storeId) => client.validateWebhook({ storeId, url })));
    },
  },
  discount: {
    description: "Check a discount code is valid and redeemable",
    stores: "ownership",
    required: ["--discount-id <id>", "Discount ID to validate"],
    storeIdsHelp: "Store ID for ownership check (first ID used)",
    examples: ["fresh-squeezy validate discount --store-ids 12 --discount-id 123"],
    run: (client, options) =>
      client.validateDiscount({
        discountId: required(
          options.discountId,
          "--discount-id is required for `validate discount`.",
        ),
        storeId: requiredStoreId(options, "discount"),
      }),
  },
  "license-key": {
    description: "Check a license key is active and not at its activation limit",
    stores: "ownership",
    required: ["--license-key-id <id>", "License key ID to validate"],
    storeIdsHelp: "Store ID for ownership check (first ID used)",
    examples: ["fresh-squeezy validate license-key --store-ids 12 --license-key-id 123"],
    run: (client, options) =>
      client.validateLicenseKey({
        licenseKeyId: required(
          options.licenseKeyId,
          "--license-key-id is required for `validate license-key`.",
        ),
        storeId: requiredStoreId(options, "license-key"),
      }),
  },
  "subscription-plan": {
    description: "Check a subscription plan variant has valid billing interval and trial config",
    stores: "ownership",
    required: ["--variant-id <id>", "Variant ID of the subscription plan"],
    storeIdsHelp: "Store ID for ownership check (first ID used)",
    examples: ["fresh-squeezy validate subscription-plan --store-ids 12 --variant-id 123"],
    run: (client, options) =>
      client.validateSubscriptionPlan({
        variantId: required(
          options.variantId,
          "--variant-id is required for `validate subscription-plan`.",
        ),
        storeId: requiredStoreId(options, "subscription-plan"),
      }),
  },
} satisfies Record<string, ValidateTargetSpec>;

export type ValidateTarget = keyof typeof VALIDATE_TARGETS;

const errorHints = (err: unknown, target: ValidateTarget): string[] => {
  if (!(err instanceof FreshSqueezyError)) return [];
  if (err.code === "MISSING_API_KEY") return MISSING_API_KEY_HINTS;
  if (err.code === "INVALID_MODE") {
    return [
      `fresh-squeezy validate ${target} --mode test`,
      `fresh-squeezy validate ${target} --mode live`,
    ];
  }
  if (err.code === "MISSING_ARG") return VALIDATE_TARGETS[target].examples;
  return [];
};

const writeResults = (
  results: ValidationResult | ValidationResult[],
  options: ValidateCommandOptions,
): number => {
  const list = Array.isArray(results) ? results : [results];
  if (options.json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    const separator = Array.isArray(results) ? "\n\n" : "\n";
    for (const result of list) process.stdout.write(`${renderResult(result)}${separator}`);
  }
  return list.every((result) => result.ok) ? 0 : 1;
};

/**
 * `fresh-squeezy validate <target>` — run one validator. Store-scoped targets
 * reuse the same store resolution the `doctor` command uses, so a single
 * `--store-ids` flag or interactive pick works across every subcommand.
 *
 * Connection runs once (no stores needed). Store/webhook loop per resolved
 * store. Product runs once because a product ID identifies a single resource;
 * the `--store-ids` value (if any) is used for the cross-store ownership check.
 */
export const runValidateCommand = async (
  target: ValidateTarget,
  options: ValidateCommandOptions,
): Promise<number> => {
  try {
    const client = createFreshSqueezy({ mode: options.mode });
    return writeResults(await VALIDATE_TARGETS[target].run(client, options), options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(renderCliError(message, errorHints(err, target)));
    return 2;
  }
};
