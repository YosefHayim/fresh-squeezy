import { createFreshSqueezy, type FreshSqueezyClient } from "../../createFreshSqueezy.js";
import { FreshSqueezyError } from "../../core/errors.js";
import type { Mode, ValidationResult } from "../../core/types.js";
import { renderResult } from "../render.js";
import { resolveStores } from "../resolveStores.js";

export interface ValidateCommandOptions {
  mode?: Mode;
  storeIds?: string[];
  allStores?: boolean;
  productId?: string;
  webhookUrl?: string;
  json?: boolean;
  isInteractive?: boolean;
}

export type ValidateTarget = "connection" | "store" | "product" | "webhook";

/**
 * `fresh-squeezy validate <target>` — run one validator. Store-scoped targets
 * reuse the same store resolution the `doctor` command uses, so a single
 * `--store-ids` flag or interactive pick works across every subcommand.
 *
 * Connection runs once (no stores needed). Store/webhook loop per resolved
 * store. Product runs once because a product ID identifies a single resource;
 * the `--store-ids` value (if any) is used for the cross-store ownership check.
 */
export async function runValidateCommand(
  target: ValidateTarget,
  options: ValidateCommandOptions
): Promise<number> {
  try {
    const client = createFreshSqueezy({ mode: options.mode });

    if (target === "connection") {
      return emit(await client.validateConnection(), options);
    }

    if (target === "product") {
      return emit(await runProduct(client, options), options);
    }

    const storeIds = await resolveStoresForTarget(client, target, options);
    const results = await runPerStore(client, target, storeIds, options);

    if (options.json) {
      process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    } else {
      for (const result of results) {
        process.stdout.write(`${renderResult(result)}\n\n`);
      }
    }

    return results.every((result) => result.ok) ? 0 : 1;
  } catch (err) {
    const message =
      err instanceof FreshSqueezyError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    process.stderr.write(`fresh-squeezy: ${message}\n`);
    return 2;
  }
}

async function resolveStoresForTarget(
  client: FreshSqueezyClient,
  target: ValidateTarget,
  options: ValidateCommandOptions
): Promise<string[]> {
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
}

async function runPerStore(
  client: FreshSqueezyClient,
  target: ValidateTarget,
  storeIds: string[],
  options: ValidateCommandOptions
): Promise<ValidationResult[]> {
  if (target === "store") {
    return Promise.all(storeIds.map((id) => client.validateStore(id)));
  }
  if (target === "webhook") {
    const url = required(options.webhookUrl, "--webhook-url is required for `validate webhook`.");
    return Promise.all(
      storeIds.map((storeId) => client.validateWebhook({ storeId, url }))
    );
  }
  return [];
}

async function runProduct(
  client: FreshSqueezyClient,
  options: ValidateCommandOptions
): Promise<ValidationResult> {
  const productId = required(options.productId, "--product-id is required for `validate product`.");
  const expected = options.storeIds?.[0];
  return client.validateProduct({
    productId,
    expectedStoreId: expected,
  });
}

function emit(result: ValidationResult, options: ValidateCommandOptions): number {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderResult(result)}\n`);
  }
  return result.ok ? 0 : 1;
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === null || value === "") {
    throw new FreshSqueezyError({ code: "MISSING_ARG", message });
  }
  return value;
}
