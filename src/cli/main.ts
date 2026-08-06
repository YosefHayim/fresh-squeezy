import { readFileSync } from "node:fs";
import { Command } from "commander";
import dotenv from "dotenv";
import type { Mode } from "../core/types.js";
import type { OpVerb } from "../resources/registry.js";
import { runAugmentCommand } from "./commands/augment.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runInitCommand } from "./commands/init.js";
import { runLauncherCommand } from "./commands/launcher.js";
import { runResourceOpCommand } from "./commands/resourceOps.js";
import { type ValidateTarget, runValidateCommand } from "./commands/validate.js";
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

dotenv.config();

const OP_VERBS: OpVerb[] = [
  "get",
  "list",
  "create",
  "update",
  "delete",
  "cancel",
  "refund",
  "generate-invoice",
  "current-usage",
];

const parseMode = (value: string): Mode => {
  if (value === "test" || value === "live") return value;
  throw new Error(`Mode must be "test" or "live", got "${value}"`);
};

const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const readPackageVersion = (): string => {
  const candidates = [
    new URL("../package.json", import.meta.url),
    new URL("../../package.json", import.meta.url),
  ];

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown };
      if (typeof pkg.version === "string") return pkg.version;
    } catch {
      // Source runs from src/cli; the built binary runs from dist.
    }
  }

  return "0.0.0";
};

const isInteractive = Boolean(process.stdin.isTTY);
const packageVersion = readPackageVersion();

interface SharedCliOpts {
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

interface DoctorCliOpts extends SharedCliOpts {
  allResources?: boolean;
}

interface ResourceOpCliOpts {
  mode?: Mode;
  id?: string;
  storeIds?: string[];
  parentId?: string;
  body?: string;
  bodyFile?: string;
  yes?: boolean;
  json?: boolean;
}

/** Store-flag shapes reused by validate targets. */
type StoreFlagKind = "none" | "multi" | "ownership";

interface ValidateCommandSpec {
  name: ValidateTarget;
  description: string;
  stores: StoreFlagKind;
  required?: [flag: string, description: string];
  /** Extra store-ids help text when `stores` is multi/ownership. */
  storeIdsHelp?: string;
}

const VALIDATE_COMMANDS: ValidateCommandSpec[] = [
  {
    name: "connection",
    description: "Check that the API key authenticates",
    stores: "none",
  },
  {
    name: "store",
    description: "Check one or more stores are reachable",
    stores: "multi",
    storeIdsHelp: "Comma-separated store IDs",
  },
  {
    name: "product",
    description: "Check a product is published with at least one variant",
    stores: "ownership",
    required: ["--product-id <id>", "Product ID to validate"],
    storeIdsHelp: "Expected owning store IDs (first is used for cross-check)",
  },
  {
    name: "webhook",
    description: "Check a webhook is registered with the recommended events",
    stores: "multi",
    required: ["--webhook-url <url>", "Public webhook URL"],
    storeIdsHelp: "Comma-separated store IDs",
  },
  {
    name: "discount",
    description: "Check a discount code is valid and redeemable",
    stores: "ownership",
    required: ["--discount-id <id>", "Discount ID to validate"],
    storeIdsHelp: "Store ID for ownership check (first ID used)",
  },
  {
    name: "license-key",
    description: "Check a license key is active and not at its activation limit",
    stores: "ownership",
    required: ["--license-key-id <id>", "License key ID to validate"],
    storeIdsHelp: "Store ID for ownership check (first ID used)",
  },
  {
    name: "subscription-plan",
    description: "Check a subscription plan variant has valid billing interval and trial config",
    stores: "ownership",
    required: ["--variant-id <id>", "Variant ID of the subscription plan"],
    storeIdsHelp: "Store ID for ownership check (first ID used)",
  },
];

const exitWith = async (code: Promise<number> | number): Promise<void> => {
  process.exit(await code);
};

const toValidateOptions = (opts: SharedCliOpts) => ({
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

const attachModeJson = (cmd: Command): Command =>
  cmd
    .option("-m, --mode <mode>", "test or live", parseMode)
    .option("--json", "Emit machine-readable JSON");

const attachValidateFlags = (cmd: Command, spec: ValidateCommandSpec): Command => {
  if (spec.required) cmd.requiredOption(spec.required[0], spec.required[1]);

  if (spec.stores === "multi") {
    cmd
      .option("--store-ids <ids>", spec.storeIdsHelp ?? "Comma-separated store IDs", parseCsv)
      .option("--all-stores", "Run against every reachable store");
  } else if (spec.stores === "ownership") {
    cmd.option(
      "--store-ids <ids>",
      spec.storeIdsHelp ?? "Store ID for ownership check (first ID used)",
      parseCsv,
    );
  }

  return attachModeJson(cmd);
};

const program = new Command();

program
  .name("fresh-squeezy")
  .description(
    "Dual-mode Lemon Squeezy CLI: doctor/validate pre-flight + docs-backed resource ops (get/list/create/…)",
  )
  .version(packageVersion)
  .option("--no-install", "Skip adding fresh-squeezy to devDependencies before guided setup")
  .showSuggestionAfterError()
  .showHelpAfterError("\nRun `fresh-squeezy --help` for examples.");

program.addHelpText(
  "after",
  `
Start (doctor setup):
  fresh-squeezy              add as a dev dependency, then run guided setup
  fresh-squeezy --no-install run guided setup without editing package.json
  fresh-squeezy doctor --all-stores --all-resources
  fresh-squeezy validate webhook --store-ids 12 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy

Ops (docs-backed Lemon Squeezy API only — products/variants are read-only):
  fresh-squeezy ops --list
  fresh-squeezy get product --id 42 --json
  fresh-squeezy list webhook --store-ids 12
  fresh-squeezy create webhook --body-file webhook.json --yes
  fresh-squeezy cancel subscription --id 9 --yes
  fresh-squeezy refund order --id 100 --yes
  fresh-squeezy generate-invoice order --id 100 --yes

Safety: delete/cancel/refund always need --yes (or TTY confirm); live-mode writes need --yes too.
Bodies are JSON:API documents via --body or --body-file (not flat flags).

Store selection:
  Use --store-ids 12,34 for explicit stores, --all-stores for automation, or run in a TTY to pick stores interactively.
`,
);

program.action(async (opts: { install?: boolean }) => {
  if (!isInteractive) {
    process.stderr.write(
      renderCliError("`fresh-squeezy` guided setup requires an interactive terminal.", [
        "fresh-squeezy doctor --all-stores",
        "fresh-squeezy validate connection",
      ]),
    );
    process.exit(2);
  }

  await exitWith(
    runLauncherCommand({
      isInteractive,
      install: opts.install,
      packageVersion,
    }),
  );
});

const doctor = program
  .command("doctor")
  .description("Run the full integration doctor")
  .option("-m, --mode <mode>", "test or live", parseMode)
  .option("--store-ids <ids>", "Comma-separated store IDs (e.g. 1,2,3)", parseCsv)
  .option("--all-stores", "Run against every reachable store, no prompt")
  .option(
    "--all-resources",
    "Discover and validate every supported resource in each selected store",
  )
  .option("--product-id <id>", "Product to validate")
  .option("--webhook-url <url>", "Webhook URL to validate")
  .option("--discount-id <id>", "Discount to validate")
  .option("--license-key-id <id>", "License key to validate")
  .option("--variant-id <id>", "Subscription plan variant to validate")
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: DoctorCliOpts) => {
    await exitWith(
      runDoctorCommand({
        ...toValidateOptions(opts),
        allResources: Boolean(opts.allResources),
      }),
    );
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
`,
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
`,
);

for (const spec of VALIDATE_COMMANDS) {
  attachValidateFlags(validate.command(spec.name).description(spec.description), spec).action(
    async (opts: SharedCliOpts) => {
      await exitWith(runValidateCommand(spec.name, toValidateOptions(opts)));
    },
  );
}

program
  .command("init")
  .description("Interactive setup: ask for credentials, pick a store, run doctor")
  .option("--env-file <path>", "Where to write credentials (default: .env)")
  .action(async (opts: { envFile?: string }) => {
    await exitWith(runInitCommand({ envFile: opts.envFile, isInteractive }));
  });

const types = program
  .command("types")
  .description(
    "Type-augmentation utilities for the official Lemon Squeezy SDK and hand-rolled types",
  );

types
  .command("augment")
  .description(
    "Generate a .d.ts that intersects your Lemon Squeezy resource types with changelog fields fresh-squeezy tracks.",
  )
  .option("--out <path>", "Output path (default: lemonsqueezy.augment.d.ts in CWD)")
  .option("--force", "Emit the generic file even when @lemonsqueezy/lemonsqueezy.js is detected")
  .action(async (opts: { out?: string; force?: boolean }) => {
    await exitWith(runAugmentCommand({ out: opts.out, force: Boolean(opts.force) }));
  });

program
  .command("ops")
  .description("List docs-backed resource ops (Lemon Squeezy official API matrix)")
  .option("--list", "Print the full verb matrix", true)
  .option("--json", "Emit machine-readable JSON")
  .action(async (opts: { json?: boolean }) => {
    await exitWith(
      runResourceOpCommand({
        resource: "",
        verb: "get",
        listCatalog: true,
        json: Boolean(opts.json),
      }),
    );
  });

for (const verb of OP_VERBS) {
  program
    .command(`${verb} <resource>`)
    .description(`Docs-backed ${verb} for a Lemon Squeezy resource`)
    .option("-m, --mode <mode>", "test or live", parseMode)
    .option("--id <id>", "Resource id")
    .option(
      "--store-ids <ids>",
      "Comma-separated store IDs (first used for list filters)",
      parseCsv,
    )
    .option(
      "--parent-id <id>",
      "Parent resource id for nested lists (product, order, subscription, …)",
    )
    .option("--body <json>", "JSON:API body string")
    .option("--body-file <path>", "Path to JSON:API body file")
    .option("--yes", "Skip confirm; required for live writes and destructive ops when non-TTY")
    .option("--json", "Emit machine-readable JSON")
    .action(async (resource: string, opts: ResourceOpCliOpts) => {
      await exitWith(
        runResourceOpCommand({
          verb,
          resource,
          mode: opts.mode,
          id: opts.id,
          storeIds: opts.storeIds,
          parentId: opts.parentId,
          body: opts.body,
          bodyFile: opts.bodyFile,
          yes: Boolean(opts.yes),
          json: Boolean(opts.json),
          isInteractive,
        }),
      );
    });
}

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const hints = message.includes("Mode must be")
    ? ["fresh-squeezy doctor --mode test", "fresh-squeezy doctor --mode live"]
    : ["fresh-squeezy --help"];
  process.stderr.write(renderCliError(message, hints));
  process.exit(2);
});
