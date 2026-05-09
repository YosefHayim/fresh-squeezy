import { createFreshSqueezy, type FreshSqueezyClient } from "../../createFreshSqueezy.js";
import { FreshSqueezyError } from "../../core/errors.js";
import type { DoctorReport, Mode } from "../../core/types.js";
import { getDoctorHints, renderCliError } from "../errors.js";
import { discoverInitResourceChoices, type InitResourceChoices } from "../resourceDiscovery.js";
import { renderReport } from "../render.js";
import { resolveStores } from "../resolveStores.js";
import type { InitDoctorTarget } from "../prompts.js";

export interface DoctorCommandOptions {
  mode?: Mode;
  storeIds?: string[];
  allStores?: boolean;
  allResources?: boolean;
  productId?: string;
  webhookUrl?: string;
  discountId?: string;
  licenseKeyId?: string;
  variantId?: string;
  json?: boolean;
  isInteractive?: boolean;
}

/**
 * Aggregate payload emitted when `--json` is set. When a single store is
 * resolved, `reports` still contains one entry — consumers always see an
 * array so JSON parsers don't need two code paths.
 */
export interface DoctorJsonOutput {
  ok: boolean;
  mode: Mode;
  reports: DoctorReport[];
}

const ALL_RESOURCE_TARGETS: InitDoctorTarget[] = [
  "product",
  "webhook",
  "discount",
  "license-key",
  "subscription-plan",
];

/**
 * `fresh-squeezy doctor` — run every validator across each resolved store and
 * emit one combined exit code. Store resolution (flag → --all-stores → TTY
 * prompt → connection-only) lives in resolveStores so validate commands can
 * reuse it.
 */
export async function runDoctorCommand(options: DoctorCommandOptions): Promise<number> {
  try {
    const client = createFreshSqueezy({ mode: options.mode });
    const resolved = await resolveStores(client, {
      storeIds: options.storeIds,
      allStores: options.allStores,
      isInteractive: options.isInteractive ?? false,
    });

    if (resolved.skipped) {
      return await runConnectionOnly(client, options);
    }

    const reports = await Promise.all(
      resolved.storeIds.map(async (storeId) => {
        const targets = await resolveDoctorTargets(client, storeId, options);
        return client.doctor({ storeId, ...targets });
      })
    );

    const ok = reports.every((report) => report.ok);
    const payload: DoctorJsonOutput = { ok, mode: client.mode, reports };

    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      for (const report of reports) {
        process.stdout.write(`${renderReport(report)}\n\n`);
      }
      if (!options.allResources && !hasExplicitResourceSelection(options)) {
        process.stderr.write(
          "fresh-squeezy: resource checks were skipped; pass --all-resources or explicit resource flags to validate products, webhooks, discounts, license keys, and subscription plans.\n"
        );
      }
    }

    return ok ? 0 : 1;
  } catch (err) {
    writeFatal(err, options.json ?? false);
    return 2;
  }
}

async function resolveDoctorTargets(
  client: FreshSqueezyClient,
  storeId: string,
  options: DoctorCommandOptions
): Promise<{
  productIds?: string[];
  webhookUrls?: string[];
  discountIds?: string[];
  licenseKeyIds?: string[];
  variantIds?: string[];
}> {
  const explicit = {
    productIds: one(options.productId),
    webhookUrls: one(options.webhookUrl),
    discountIds: one(options.discountId),
    licenseKeyIds: one(options.licenseKeyId),
    variantIds: one(options.variantId),
  };

  if (!options.allResources) return explicit;

  const discovered = await discoverInitResourceChoices(client, storeId, ALL_RESOURCE_TARGETS);
  reportDiscoveryErrors(discovered);
  if (!options.json) {
    process.stderr.write(
      `fresh-squeezy: discovered store ${storeId} resources: ${formatDiscoveryCounts(discovered)}.\n`
    );
  }

  return {
    productIds: mergeValues(explicit.productIds, values(discovered.products)),
    webhookUrls: mergeValues(explicit.webhookUrls, values(discovered.webhooks)),
    discountIds: mergeValues(explicit.discountIds, values(discovered.discounts)),
    licenseKeyIds: mergeValues(explicit.licenseKeyIds, values(discovered.licenseKeys)),
    variantIds: mergeValues(explicit.variantIds, values(discovered.subscriptionPlans)),
  };
}

function formatDiscoveryCounts(choices: InitResourceChoices): string {
  return [
    countLabel("products", choices.products.choices.length),
    countLabel("webhooks", choices.webhooks.choices.length),
    countLabel("discounts", choices.discounts.choices.length),
    countLabel("license keys", choices.licenseKeys.choices.length),
    countLabel("subscription plans", choices.subscriptionPlans.choices.length),
  ].join(", ");
}

function countLabel(label: string, count: number): string {
  return `${label} ${count}`;
}

function reportDiscoveryErrors(choices: InitResourceChoices): void {
  const errors = [
    choices.products.error && `products: ${choices.products.error}`,
    choices.webhooks.error && `webhooks: ${choices.webhooks.error}`,
    choices.discounts.error && `discounts: ${choices.discounts.error}`,
    choices.licenseKeys.error && `license keys: ${choices.licenseKeys.error}`,
    choices.subscriptionPlans.error && `subscription plans: ${choices.subscriptionPlans.error}`,
  ].filter((entry): entry is string => Boolean(entry));

  for (const error of errors) {
    process.stderr.write(`fresh-squeezy: discovery skipped ${error}\n`);
  }
}

function values(group: { choices: Array<{ value: string }> }): string[] | undefined {
  return group.choices.length > 0 ? group.choices.map((choice) => choice.value) : undefined;
}

function one(value: string | undefined): string[] | undefined {
  return value ? [value] : undefined;
}

function mergeValues(
  explicit: string[] | undefined,
  discovered: string[] | undefined
): string[] | undefined {
  const merged = Array.from(new Set([...(explicit ?? []), ...(discovered ?? [])]));
  return merged.length > 0 ? merged : undefined;
}

function hasExplicitResourceSelection(options: DoctorCommandOptions): boolean {
  return Boolean(
    options.productId ||
      options.webhookUrl ||
      options.discountId ||
      options.licenseKeyId ||
      options.variantId
  );
}

/**
 * Fallback when no store could be resolved and we are not interactive.
 * Running connection-only gives CI a useful signal ("key works") without
 * silently pretending everything is fine.
 */
async function runConnectionOnly(
  client: FreshSqueezyClient,
  options: DoctorCommandOptions
): Promise<number> {
  const connection = await client.validateConnection();
  const report: DoctorReport = {
    ok: connection.ok,
    mode: client.mode,
    results: [connection],
  };
  const payload: DoctorJsonOutput = { ok: connection.ok, mode: client.mode, reports: [report] };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stderr.write(
      "fresh-squeezy: no --store-ids or --all-stores and stdin is not a TTY; running connection-only.\n"
    );
    process.stdout.write(`${renderReport(report)}\n`);
  }
  return connection.ok ? 0 : 1;
}

function writeFatal(err: unknown, asJson: boolean): void {
  if (asJson) {
    const payload =
      err instanceof FreshSqueezyError
        ? { ok: false, error: { code: err.code, message: err.message, status: err.status ?? null } }
        : { ok: false, error: { code: "UNKNOWN", message: err instanceof Error ? err.message : String(err) } };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(renderCliError(message, getDoctorHints(err)));
}
