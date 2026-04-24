import { createFreshSqueezy, type FreshSqueezyClient } from "../../createFreshSqueezy.js";
import { FreshSqueezyError } from "../../core/errors.js";
import type { DoctorReport, Mode } from "../../core/types.js";
import { renderReport } from "../render.js";
import { resolveStores } from "../resolveStores.js";

export interface DoctorCommandOptions {
  mode?: Mode;
  storeIds?: string[];
  allStores?: boolean;
  productId?: string;
  webhookUrl?: string;
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
      resolved.storeIds.map((storeId) =>
        client.doctor({
          storeId,
          productId: options.productId,
          webhookUrl: options.webhookUrl,
        })
      )
    );

    const ok = reports.every((report) => report.ok);
    const payload: DoctorJsonOutput = { ok, mode: client.mode, reports };

    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      for (const report of reports) {
        process.stdout.write(`${renderReport(report)}\n\n`);
      }
    }

    return ok ? 0 : 1;
  } catch (err) {
    writeFatal(err, options.json ?? false);
    return 2;
  }
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
  process.stderr.write(`fresh-squeezy: ${message}\n`);
}
