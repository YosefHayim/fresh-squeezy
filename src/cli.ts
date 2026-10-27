import { readFileSync } from "node:fs";
import { Command } from "commander";
import dotenv from "dotenv";
import type { OpVerb } from "@/features/ops/resource-registry.js";
import { parseMode } from "@/shared/config.js";
import { isFreshSqueezyError } from "@/shared/errors.js";
import {
	type AugmentCommandOptions,
	runAugmentCommand,
} from "./app/augment-command.js";
import { splitCsv } from "./app/csv-values.js";
import {
	type DoctorCommandOptions,
	runDoctorCommand,
} from "./app/doctor-command.js";
import { runInitCommand } from "./app/init-command.js";
import { runLauncherCommand } from "./app/launcher-menu.js";
import { runOpsCatalogCommand } from "./app/ops-catalog-command.js";
import {
	type OpsCommandOptions,
	runResourceOpCommand,
} from "./app/ops-command.js";
import { writeCliFailure, writeNeedsTerminalError } from "./app/render.js";
import {
	runValidateCommand,
	VALIDATE_SUBCOMMANDS,
	type ValidateCommandOptions,
	type ValidateSubcommand,
	type ValidateSubcommandSpec,
} from "./app/validate-command.js";

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

const readPackageVersion = (): string => {
	const candidates = [
		new URL("../package.json", import.meta.url),
		new URL("../../package.json", import.meta.url),
	];

	for (const candidate of candidates) {
		try {
			const manifestText = readFileSync(candidate, "utf8");
			const manifest = JSON.parse(manifestText) as { version?: unknown };
			const version = manifest.version;
			const isVersionText = typeof version === "string";
			if (isVersionText) return version;
		} catch {
			// Source runs from src/cli; the built binary runs from dist.
		}
	}

	return "0.0.0";
};

const isInteractive = Boolean(process.stdin.isTTY);
const packageVersion = readPackageVersion();

const attachModeJson = (cmd: Command): Command =>
	cmd
		.option("-m, --mode <mode>", "test or live", parseMode)
		.option("--json", "Emit machine-readable JSON");

const attachValidateFlags = (
	cmd: Command,
	spec: ValidateSubcommandSpec,
): Command => {
	const requiredOption = spec.required;
	const isOptionRequired = requiredOption !== undefined;
	if (isOptionRequired)
		cmd.requiredOption(requiredOption[0], requiredOption[1]);

	const areStoresMulti = spec.stores === "multi";
	const areStoresOwnership = spec.stores === "ownership";
	if (areStoresMulti) {
		cmd
			.option(
				"--store-ids <ids>",
				spec.storeIdsHelp ?? "Comma-separated store IDs",
				splitCsv,
			)
			.option("--all-stores", "Run against every reachable store");
	} else if (areStoresOwnership) {
		cmd.option(
			"--store-ids <ids>",
			spec.storeIdsHelp ?? "Store ID for ownership check (first ID used)",
			splitCsv,
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
	.option(
		"--no-install",
		"Skip adding fresh-squeezy to devDependencies before guided setup",
	)
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
	const isNonInteractive = !isInteractive;
	if (isNonInteractive) {
		writeNeedsTerminalError("`fresh-squeezy` guided setup");
		process.exitCode = 2;
		return;
	}

	process.exitCode = await runLauncherCommand({
		install: opts.install,
		packageVersion,
	});
});

const doctor = program
	.command("doctor")
	.description("Run the full integration doctor")
	.option("-m, --mode <mode>", "test or live", parseMode)
	.option(
		"--store-ids <ids>",
		"Comma-separated store IDs (e.g. 1,2,3)",
		splitCsv,
	)
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
	.action(async (opts: DoctorCommandOptions) => {
		process.exitCode = await runDoctorCommand({ ...opts, isInteractive });
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

const validate = program
	.command("validate")
	.description("Run a single validator");

validate.addHelpText(
	"after",
	`
Examples:
  fresh-squeezy validate connection
  fresh-squeezy validate store --all-stores
  fresh-squeezy validate webhook --store-ids 12 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy

Targets:
  ${Object.keys(VALIDATE_SUBCOMMANDS).join(", ")}
`,
);

for (const [name, spec] of Object.entries(VALIDATE_SUBCOMMANDS) as [
	ValidateSubcommand,
	ValidateSubcommandSpec,
][]) {
	const validateCommand = validate.command(name).description(spec.description);
	attachValidateFlags(validateCommand, spec).action(
		async (opts: ValidateCommandOptions) => {
			process.exitCode = await runValidateCommand(name, {
				...opts,
				isInteractive,
			});
		},
	);
}

program
	.command("init")
	.description(
		"Interactive setup: ask for credentials, pick a store, run doctor",
	)
	.option("--env-file <path>", "Where to write credentials (default: .env)")
	.action(async (opts: { envFile?: string }) => {
		process.exitCode = await runInitCommand({ ...opts, isInteractive });
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
	.option(
		"--out <path>",
		"Output path (default: lemonsqueezy.augment.d.ts in CWD)",
	)
	.option(
		"--force",
		"Emit the generic file even when @lemonsqueezy/lemonsqueezy.js is detected",
	)
	.action(async (opts: AugmentCommandOptions) => {
		process.exitCode = await runAugmentCommand(opts);
	});

program
	.command("ops")
	.description(
		"List docs-backed resource ops (Lemon Squeezy official API matrix)",
	)
	.option("--list", "Print the full verb matrix", true)
	.option("--json", "Emit machine-readable JSON")
	.action((opts: { json?: boolean }) => {
		process.exitCode = runOpsCatalogCommand(opts);
	});

const BULK_VERBS: readonly OpVerb[] = ["delete", "cancel", "refund"];

const BULK_EXAMPLE_RESOURCES: Partial<Record<OpVerb, string>> = {
	delete: "discount",
	cancel: "subscription",
	refund: "order",
};

const opHelpText = (verb: OpVerb): string => {
	const isNotBulkVerb = !BULK_VERBS.includes(verb);
	if (isNotBulkVerb) {
		return `\nExample:\n  fresh-squeezy ${verb} <resource> --id 42 --json\n`;
	}
	const exampleResource = BULK_EXAMPLE_RESOURCES[verb] ?? "order";
	return `
Examples:
  fresh-squeezy ${verb} ${exampleResource} --id 42 --yes
  fresh-squeezy ${verb} ${exampleResource} --ids 1,2,3 --yes
  fresh-squeezy ${verb} ${exampleResource} --all --store-ids 12 --dry-run
  fresh-squeezy ${verb} ${exampleResource} --all --store-ids 12 --match TEST --yes --json

Bulk notes:
  --all lists every page first, then asks once (TTY) or needs --yes (non-TTY).
  Store falls back to LEMON_SQUEEZY_STORE_ID when --store-ids is omitted.
  Exit codes: 0 ok, 1 some items failed, 2 usage error / declined.
`;
};

for (const verb of OP_VERBS) {
	const verbHelpText = opHelpText(verb);
	program
		.command(`${verb} <resource>`)
		.description(`Docs-backed ${verb} for a Lemon Squeezy resource`)
		.option("-m, --mode <mode>", "test or live", parseMode)
		.option("--id <id>", "Resource id")
		.option(
			"--store-ids <ids>",
			"Comma-separated store IDs (first used for list filters)",
			splitCsv,
		)
		.option(
			"--parent-id <id>",
			"Parent resource id for nested lists (product, order, subscription, …)",
		)
		.option("--body <json>", "JSON:API body string")
		.option("--body-file <path>", "Path to JSON:API body file")
		.option(
			"--yes",
			"Skip confirm; required for live writes and destructive ops when non-TTY",
		)
		.option("--json", "Emit machine-readable JSON")
		.option(
			"--all",
			"Bulk: apply to every item from `list` (delete, cancel, refund)",
		)
		.option(
			"--ids <ids>",
			"Bulk: comma-separated ids (delete, cancel, refund)",
			splitCsv,
		)
		.option(
			"--match <text>",
			"Bulk: with --all, only items whose name/code/url contain <text>",
		)
		.option("--dry-run", "Bulk: show what would be affected; send nothing")
		.addHelpText("after", verbHelpText)
		.action(async (resource: string, opts: OpsCommandOptions) => {
			process.exitCode = await runResourceOpCommand({
				...opts,
				verb,
				resource,
				isInteractive,
			});
		});
}

program.parseAsync(process.argv).catch((err: unknown) => {
	const isModeError = isFreshSqueezyError(err) && err.code === "INVALID_MODE";
	const hints = isModeError
		? ["fresh-squeezy doctor --mode test", "fresh-squeezy doctor --mode live"]
		: ["fresh-squeezy --help"];
	writeCliFailure(err, { hints });
	process.exitCode = 2;
});
