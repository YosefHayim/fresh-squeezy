import { readFileSync } from "node:fs";
import { Command } from "commander";
import dotenv from "dotenv";
import type { Mode } from "../core/types.js";
import { runAugmentCommand } from "./commands/augment.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runLauncherCommand } from "./commands/launcher.js";
import { runValidateCommand, type ValidateTarget } from "./commands/validate.js";
import { runInitCommand } from "./commands/init.js";
import { renderCliError } from "./errors.js";

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
const packageVersion = readPackageVersion();

const program = new Command();

program
  .name("fresh-squeezy")
  .description("Lemon Squeezy integration doctor for billing teams")
  .version(packageVersion)
  .option("--no-install", "Skip adding fresh-squeezy to devDependencies before guided setup")
  .showSuggestionAfterError()
  .showHelpAfterError("\nRun `fresh-squeezy --help` for examples.");

program.addHelpText(
  "after",
  `
Start:
  fresh-squeezy              add as a dev dependency, then run guided setup
  fresh-squeezy --no-install run guided setup without editing package.json
  fresh-squeezy doctor --all-stores --all-resources
  fresh-squeezy validate webhook --store-ids 12 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy

Store selection:
  Use --store-ids 12,34 for explicit stores, --all-stores for automation, or run in a TTY to pick stores interactively.
`
);

program.action(async (opts: { install?: boolean }) => {
  if (!isInteractive) {
    process.stderr.write(
      renderCliError("`fresh-squeezy` guided setup requires an interactive terminal.", [
        "fresh-squeezy doctor --all-stores",
        "fresh-squeezy validate connection",
      ])
    );
    process.exit(2);
  }

  const code = await runLauncherCommand({
    isInteractive,
    install: opts.install,
    packageVersion,
  });
  process.exit(code);
});

const doctor = program
  .command("doctor")
  .description("Run the full integration doctor")
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--store-ids <ids>", "Comma-separated store IDs (e.g. 1,2,3)", parseCsv)
  .option("--all-stores", "Run against every reachable store, no prompt")
  .option("--all-resources", "Discover and validate every supported resource in each selected store")
  .option("--product-id <id>", "Product to validate")
  .option("--webhook-url <url>", "Webhook URL to validate")
  .option("--discount-id <id>", "Discount to validate")
  .option("--license-key-id <id>", "License key to validate")
  .option("--variant-id <id>", "Subscription plan variant to validate")
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: DoctorCliOpts) => {
    const code = await runDoctorCommand({
      mode: opts.mode,
      storeIds: opts.storeIds,
      allStores: Boolean(opts.allStores),
      allResources: Boolean(opts.allResources),
      productId: opts.productId,
      webhookUrl: opts.webhookUrl,
      discountId: opts.discountId,
      licenseKeyId: opts.licenseKeyId,
      variantId: opts.variantId,
      json: Boolean(opts.json),
      isInteractive,
    });
    process.exit(code);
  });

doctor.addHelpText(
  "after",
  `
Examples:
  fresh-squeezy doctor
  fresh-squeezy doctor --all-stores
  fresh-squeezy doctor --all-stores --all-resources
  fresh-squeezy doctor --store-ids 12 --product-id 987 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy
  fresh-squeezy doctor --all-stores --all-resources --json
`
);

const validate = program.command("validate").description("Run a single validator");

validate.addHelpText(
  "after",
  `
Examples:
  fresh-squeezy validate connection
  fresh-squeezy validate store --all-stores
  fresh-squeezy validate webhook --store-ids 12 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy

Targets:
  connection, store, product, webhook, discount, license-key, subscription-plan
`
);

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

validate
  .command("discount")
  .description("Check a discount code is valid and redeemable")
  .requiredOption("--discount-id <id>", "Discount ID to validate")
  .option("--store-ids <ids>", "Store ID for ownership check (first ID used)", parseCsv)
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: ValidateCliOpts) => runValidate("discount", opts));

validate
  .command("license-key")
  .description("Check a license key is active and not at its activation limit")
  .requiredOption("--license-key-id <id>", "License key ID to validate")
  .option("--store-ids <ids>", "Store ID for ownership check (first ID used)", parseCsv)
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: ValidateCliOpts) => runValidate("license-key", opts));

validate
  .command("subscription-plan")
  .description("Check a subscription plan variant has valid billing interval and trial config")
  .requiredOption("--variant-id <id>", "Variant ID of the subscription plan")
  .option("--store-ids <ids>", "Store ID for ownership check (first ID used)", parseCsv)
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: ValidateCliOpts) => runValidate("subscription-plan", opts));

program
  .command("init")
  .description("Interactive setup: ask for credentials, pick a store, run doctor")
  .option("--env-file <path>", "Where to write credentials (default: .env.local)")
  .action(async (opts: { envFile?: string }) => {
    const code = await runInitCommand({ envFile: opts.envFile, isInteractive });
    process.exit(code);
  });

const types = program
  .command("types")
  .description("Type-augmentation utilities for the official Lemon Squeezy SDK and hand-rolled types");

types
  .command("augment")
  .description(
    "Generate a .d.ts that intersects your Lemon Squeezy resource types with changelog fields fresh-squeezy tracks."
  )
  .option("--out <path>", "Output path (default: lemonsqueezy.augment.d.ts in CWD)")
  .option("--force", "Emit the generic file even when @lemonsqueezy/lemonsqueezy.js is detected")
  .action(async (opts: { out?: string; force?: boolean }) => {
    const code = await runAugmentCommand({ out: opts.out, force: Boolean(opts.force) });
    process.exit(code);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const hints = message.includes("Mode must be")
    ? ["fresh-squeezy doctor --mode test", "fresh-squeezy doctor --mode live"]
    : ["fresh-squeezy --help"];
  process.stderr.write(renderCliError(message, hints));
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

function readPackageVersion(): string {
  const candidates = [
    new URL("../package.json", import.meta.url),
    new URL("../../package.json", import.meta.url),
  ];

  for (const candidate of candidates) {
    try {
      const payload = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown };
      if (typeof payload.version === "string") return payload.version;
    } catch {
      // Try the next path. Source runs from src/cli, the built binary runs from dist.
    }
  }

  return "0.0.0";
}

interface DoctorCliOpts {
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
}

interface ValidateCliOpts {
  mode?: Mode;
  storeIds?: string[];
  allStores?: boolean;
  productId?: string;
  webhookUrl?: string;
  discountId?: string;
  licenseKeyId?: string;
  variantId?: string;
  json?: boolean;
}

async function runValidate(target: ValidateTarget, opts: ValidateCliOpts): Promise<void> {
  const code = await runValidateCommand(target, {
    mode: opts.mode,
    storeIds: opts.storeIds,
    allStores: Boolean(opts.allStores),
    productId: opts.productId,
    webhookUrl: opts.webhookUrl,
    discountId: opts.discountId,
    licenseKeyId: opts.licenseKeyId,
    variantId: opts.variantId,
    json: Boolean(opts.json),
    isInteractive,
  });
  process.exit(code);
}
