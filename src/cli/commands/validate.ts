import { freshSqueezyErrorOf, isFreshSqueezyError } from "@/errors/errors.js";
import type { Mode, ValidationResult } from "@/contracts/contracts.js";
import {
	type FreshSqueezyClient,
	createFreshSqueezy,
} from "@/create-fresh-squeezy.js";
import {
	MISSING_API_KEY_HINTS,
	renderCliError,
	renderResult,
} from "@/cli/render.js";
import { resolveStores } from "@/cli/resolve-stores.js";

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

export interface ValidateSubcommandSpec {
	description: string;
	stores: "none" | "multi" | "ownership";
	storeIdsHelp?: string;
	required?: [flag: string, description: string];
	examples: string[];
	run: (
		client: FreshSqueezyClient,
		options: ValidateCommandOptions,
	) => Promise<ValidationResult | ValidationResult[]>;
}

const EXAMPLE_WEBHOOK_URL =
	"https://app.example.com/api/webhooks/lemon-squeezy";

const required = <T>(value: T | undefined, message: string): T => {
	if (value === undefined || value === null || value === "") {
		throw freshSqueezyErrorOf({ code: "MISSING_ARG", message });
	}
	return value;
};

const requiredStoreId = (
	options: ValidateCommandOptions,
	target: string,
): string =>
	required(
		options.storeIds?.[0],
		`--store-ids is required for \`validate ${target}\`.`,
	);

const resolveStoresForSubcommand = async (
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
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: `--store-ids or --all-stores is required for \`validate ${target}\` in non-interactive mode.`,
		});
	}
	return resolved.storeIds;
};

export const VALIDATE_SUBCOMMANDS = {
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
			const storeIds = await resolveStoresForSubcommand(
				client,
				"store",
				options,
			);
			return Promise.all(
				storeIds.map((storeId) => client.validateStore(storeId)),
			);
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
				productId: required(
					options.productId,
					"--product-id is required for `validate product`.",
				),
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
			const storeIds = await resolveStoresForSubcommand(
				client,
				"webhook",
				options,
			);
			const url = required(
				options.webhookUrl,
				"--webhook-url is required for `validate webhook`.",
			);
			return Promise.all(
				storeIds.map((storeId) => client.validateWebhook({ storeId, url })),
			);
		},
	},
	discount: {
		description: "Check a discount code is valid and redeemable",
		stores: "ownership",
		required: ["--discount-id <id>", "Discount ID to validate"],
		storeIdsHelp: "Store ID for ownership check (first ID used)",
		examples: [
			"fresh-squeezy validate discount --store-ids 12 --discount-id 123",
		],
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
		description:
			"Check a license key is active and not at its activation limit",
		stores: "ownership",
		required: ["--license-key-id <id>", "License key ID to validate"],
		storeIdsHelp: "Store ID for ownership check (first ID used)",
		examples: [
			"fresh-squeezy validate license-key --store-ids 12 --license-key-id 123",
		],
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
		description:
			"Check a subscription plan variant has valid billing interval and trial config",
		stores: "ownership",
		required: ["--variant-id <id>", "Variant ID of the subscription plan"],
		storeIdsHelp: "Store ID for ownership check (first ID used)",
		examples: [
			"fresh-squeezy validate subscription-plan --store-ids 12 --variant-id 123",
		],
		run: (client, options) =>
			client.validateSubscriptionPlan({
				variantId: required(
					options.variantId,
					"--variant-id is required for `validate subscription-plan`.",
				),
				storeId: requiredStoreId(options, "subscription-plan"),
			}),
	},
} satisfies Record<string, ValidateSubcommandSpec>;

export type ValidateSubcommand = keyof typeof VALIDATE_SUBCOMMANDS;

const errorHints = (err: unknown, target: ValidateSubcommand): string[] => {
	if (!isFreshSqueezyError(err)) return [];
	if (err.code === "MISSING_API_KEY") return MISSING_API_KEY_HINTS;
	if (err.code === "INVALID_MODE") {
		return [
			`fresh-squeezy validate ${target} --mode test`,
			`fresh-squeezy validate ${target} --mode live`,
		];
	}
	if (err.code === "MISSING_ARG") return VALIDATE_SUBCOMMANDS[target].examples;
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
		for (const result of list)
			process.stdout.write(`${renderResult(result)}${separator}`);
	}
	return list.every((result) => result.ok) ? 0 : 1;
};

export const runValidateCommand = async (
	target: ValidateSubcommand,
	options: ValidateCommandOptions,
): Promise<number> => {
	try {
		const client = createFreshSqueezy({ mode: options.mode });
		return writeResults(
			await VALIDATE_SUBCOMMANDS[target].run(client, options),
			options,
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(renderCliError(message, errorHints(err, target)));
		return 2;
	}
};
