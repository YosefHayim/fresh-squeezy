import { FreshSqueezyError } from "../../core/errors.js";
import type { DoctorReport, Mode } from "../../core/types.js";
import { type FreshSqueezyClient, createFreshSqueezy } from "../../createFreshSqueezy.js";
import { getDoctorHints, renderCliError, renderReport } from "../render.js";
import { resolveStores } from "../resolveStores.js";
import {
  DOCTOR_TARGETS,
  type InitDoctorTargets,
  type ResourceChoiceGroup,
  discoverDoctorChoices,
} from "../resourceDiscovery.js";

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
interface DoctorJsonOutput {
  ok: boolean;
  mode: Mode;
  reports: DoctorReport[];
}

/**
 * `fresh-squeezy doctor` — run every validator across each resolved store and
 * emit one combined exit code. Store resolution (flag → --all-stores → TTY
 * prompt → connection-only) lives in resolveStores so validate commands can
 * reuse it.
 */
export const runDoctorCommand = async (options: DoctorCommandOptions): Promise<number> => {
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
      }),
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
          "fresh-squeezy: resource checks were skipped; pass --all-resources or explicit resource flags to validate products, webhooks, discounts, license keys, and subscription plans.\n",
        );
      }
    }

    return ok ? 0 : 1;
  } catch (err) {
    writeFatal(err, options.json ?? false);
    return 2;
  }
};

const one = (value: string | undefined): string[] | undefined => (value ? [value] : undefined);

const explicitTargets = (options: DoctorCommandOptions): InitDoctorTargets => ({
  productIds: one(options.productId),
  webhookUrls: one(options.webhookUrl),
  discountIds: one(options.discountId),
  licenseKeyIds: one(options.licenseKeyId),
  variantIds: one(options.variantId),
});

const values = (group: ResourceChoiceGroup | undefined): string[] | undefined =>
  group?.choices.length ? group.choices.map((choice) => choice.value) : undefined;

const mergeValues = (
  explicit: string[] | undefined,
  discovered: string[] | undefined,
): string[] | undefined => {
  const merged = Array.from(new Set([...(explicit ?? []), ...(discovered ?? [])]));
  return merged.length > 0 ? merged : undefined;
};

const resolveDoctorTargets = async (
  client: FreshSqueezyClient,
  storeId: string,
  options: DoctorCommandOptions,
): Promise<InitDoctorTargets> => {
  const explicit = explicitTargets(options);
  if (!options.allResources) return explicit;

  const allTargets = DOCTOR_TARGETS.map((row) => row.target);
  const discovered = await discoverDoctorChoices(client, storeId, allTargets);
  for (const row of DOCTOR_TARGETS) {
    const error = discovered[row.target]?.error;
    if (error) {
      process.stderr.write(
        `fresh-squeezy: discovery skipped ${row.label.toLowerCase()}: ${error}\n`,
      );
    }
  }
  if (!options.json) {
    const counts = DOCTOR_TARGETS.map(
      (row) => `${row.label.toLowerCase()} ${discovered[row.target]?.choices.length ?? 0}`,
    ).join(", ");
    process.stderr.write(`fresh-squeezy: discovered store ${storeId} resources: ${counts}.\n`);
  }

  const merged: InitDoctorTargets = {};
  for (const row of DOCTOR_TARGETS) {
    merged[row.field] = mergeValues(explicit[row.field], values(discovered[row.target]));
  }
  return merged;
};

const hasExplicitResourceSelection = (options: DoctorCommandOptions): boolean =>
  Object.values(explicitTargets(options)).some((ids) => ids !== undefined);

/**
 * Fallback when no store could be resolved and we are not interactive.
 * Running connection-only gives CI a useful signal ("key works") without
 * silently pretending everything is fine.
 */
const runConnectionOnly = async (
  client: FreshSqueezyClient,
  options: DoctorCommandOptions,
): Promise<number> => {
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
      "fresh-squeezy: no --store-ids or --all-stores and stdin is not a TTY; running connection-only.\n",
    );
    process.stdout.write(`${renderReport(report)}\n`);
  }
  return connection.ok ? 0 : 1;
};

const writeFatal = (err: unknown, asJson: boolean): void => {
  if (asJson) {
    const code = err instanceof FreshSqueezyError ? err.code : "UNKNOWN";
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof FreshSqueezyError ? (err.status ?? null) : null;
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code, message, status } })}\n`);
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(renderCliError(message, getDoctorHints(err)));
};
