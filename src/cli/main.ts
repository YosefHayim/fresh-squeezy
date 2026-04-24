import { Command } from "commander";
import dotenv from "dotenv";
import type { Mode } from "../core/types.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runValidateCommand, type ValidateTarget } from "./commands/validate.js";
import { runInitCommand } from "./commands/init.js";

/**
 * CLI entry. Wires commander subcommands to their handlers. Each handler
 * returns an exit code; the wrapper below forwards it to `process.exit`.
 *
 * Store resolution is a CLI concern: `--store-ids 1,2,3` (CSV) for scripts,
 * `--all-stores` for "run against every reachable store", or interactive
 * multi-select when stdin is a TTY and neither flag is supplied. The library
 * API deliberately stays single-store-per-call.
 */

dotenv.config({ path: ".env.local" });
dotenv.config();

const isInteractive = Boolean(process.stdin.isTTY);

const program = new Command();

program
  .name("fresh-squeezy")
  .description("Validator-first Lemon Squeezy setup doctor")
  .version("0.1.0");

program
  .command("doctor")
  .description("Run every configured validator and emit a report")
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--store-ids <ids>", "Comma-separated store IDs (e.g. 1,2,3)", parseCsv)
  .option("--all-stores", "Run against every reachable store, no prompt")
  .option("--product-id <id>", "Product to validate")
  .option("--webhook-url <url>", "Webhook URL to validate")
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: DoctorCliOpts) => {
    const code = await runDoctorCommand({
      mode: opts.mode,
      storeIds: opts.storeIds,
      allStores: Boolean(opts.allStores),
      productId: opts.productId,
      webhookUrl: opts.webhookUrl,
      json: Boolean(opts.json),
      isInteractive,
    });
    process.exit(code);
  });

const validate = program.command("validate").description("Run a single validator");

validate
  .command("connection")
  .description("Check that the API key authenticates")
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: ValidateCliOpts) => runValidate("connection", opts));

validate
  .command("store")
  .description("Check one or more stores are reachable")
  .option("--store-ids <ids>", "Comma-separated store IDs", parseCsv)
  .option("--all-stores", "Run against every reachable store")
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: ValidateCliOpts) => runValidate("store", opts));

validate
  .command("product")
  .description("Check a product is published with at least one variant")
  .requiredOption("--product-id <id>", "Product ID to validate")
  .option("--store-ids <ids>", "Expected owning store IDs (first is used for cross-check)", parseCsv)
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: ValidateCliOpts) => runValidate("product", opts));

validate
  .command("webhook")
  .description("Check a webhook is registered with the recommended events")
  .requiredOption("--webhook-url <url>", "Public webhook URL")
  .option("--store-ids <ids>", "Comma-separated store IDs", parseCsv)
  .option("--all-stores", "Run against every reachable store")
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: ValidateCliOpts) => runValidate("webhook", opts));

program
  .command("init")
  .description("Interactive setup: ask for credentials, pick a store, run doctor")
  .option("--env-file <path>", "Where to write credentials (default: .env.local)")
  .action(async (opts: { envFile?: string }) => {
    const code = await runInitCommand({ envFile: opts.envFile });
    process.exit(code);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`fresh-squeezy: ${message}\n`);
  process.exit(2);
});

function parseMode(value: string): Mode {
  if (value === "test" || value === "live") return value;
  throw new Error(`Mode must be "test" or "live", got "${value}"`);
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

interface DoctorCliOpts {
  mode?: Mode;
  storeIds?: string[];
  allStores?: boolean;
  productId?: string;
  webhookUrl?: string;
  json?: boolean;
}

interface ValidateCliOpts {
  mode?: Mode;
  storeIds?: string[];
  allStores?: boolean;
  productId?: string;
  webhookUrl?: string;
  json?: boolean;
}

async function runValidate(target: ValidateTarget, opts: ValidateCliOpts): Promise<void> {
  const code = await runValidateCommand(target, {
    mode: opts.mode,
    storeIds: opts.storeIds,
    allStores: Boolean(opts.allStores),
    productId: opts.productId,
    webhookUrl: opts.webhookUrl,
    json: Boolean(opts.json),
    isInteractive,
  });
  process.exit(code);
}
