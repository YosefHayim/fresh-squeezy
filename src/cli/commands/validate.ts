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
	const isValueMissing = value === undefined || value === null || value === "";
	if (isValueMissing) {
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
	const wereStoresSkipped = resolved.skipped;
	if (wereStoresSkipped) {
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
			const storeValidations = storeIds.map((storeId) =>
				client.validateStore(storeId),
			);
			return Promise.all(storeValidations);
		},
	},
	product: {
		description: "Check a product is published with at least one variant",
		stores: "ownership",
		required: ["--product-id <id>", "Product ID to validate"],
		storeIdsHelp: "Expected owning store IDs (first is used for cross-check)",
		examples: ["fresh-squeezy validate product --product-id 987"],
		run: (client, options) => {
			const productId = required(
				options.productId,
				"--product-id is required for `validate product`.",
			);
			return client.validateProduct({
				productId,
				expectedStoreId: options.storeIds?.[0],
			});
		},
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
			const webhookValidations = storeIds.map((storeId) =>
				client.validateWebhook({ storeId, url }),
			);
			return Promise.all(webhookValidations);
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
		run: (client, options) => {
			const discountId = required(
				options.discountId,
				"--discount-id is required for `validate discount`.",
			);
			const storeId = requiredStoreId(options, "discount");
			return client.validateDiscount({ discountId, storeId });
		},
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
		run: (client, options) => {
			const licenseKeyId = required(
				options.licenseKeyId,
				"--license-key-id is required for `validate license-key`.",
			);
			const storeId = requiredStoreId(options, "license-key");
			return client.validateLicenseKey({ licenseKeyId, storeId });
		},
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
		run: (client, options) => {
			const variantId = required(
				options.variantId,
				"--variant-id is required for `validate subscription-plan`.",
			);
			const storeId = requiredStoreId(options, "subscription-plan");
			return client.validateSubscriptionPlan({ variantId, storeId });
		},
	},
} satisfies Record<string, ValidateSubcommandSpec>;

export type ValidateSubcommand = keyof typeof VALIDATE_SUBCOMMANDS;

const errorHints = (err: unknown, target: ValidateSubcommand): string[] => {
	const isKnownError = isFreshSqueezyError(err);
	const isUnknownError = !isKnownError;
	if (isUnknownError) return [];
	const isMissingApiKey = err.code === "MISSING_API_KEY";
	if (isMissingApiKey) return MISSING_API_KEY_HINTS;
	const isInvalidMode = err.code === "INVALID_MODE";
	if (isInvalidMode) {
		return [
			`fresh-squeezy validate ${target} --mode test`,
			`fresh-squeezy validate ${target} --mode live`,
		];
	}
	const isMissingArg = err.code === "MISSING_ARG";
	if (isMissingArg) return VALIDATE_SUBCOMMANDS[target].examples;
	return [];
};

const writeResults = (
	results: ValidationResult | ValidationResult[],
	options: ValidateCommandOptions,
): number => {
	const isListOfResults = Array.isArray(results);
	const list = isListOfResults ? results : [results];
	if (options.json) {
		const jsonOutput = JSON.stringify(results, null, 2);
		process.stdout.write(`${jsonOutput}\n`);
	} else {
		const separator = isListOfResults ? "\n\n" : "\n";
		for (const validationResult of list) {
			const renderedResult = renderResult(validationResult);
			process.stdout.write(`${renderedResult}${separator}`);
		}
	}
	const areAllResultsOk = list.every((validationResult) => validationResult.ok);
	return areAllResultsOk ? 0 : 1;
};

export const runValidateCommand = async (
	target: ValidateSubcommand,
	options: ValidateCommandOptions,
): Promise<number> => {
	try {
		const client = createFreshSqueezy({ mode: options.mode });
		const results = await VALIDATE_SUBCOMMANDS[target].run(client, options);
		return writeResults(results, options);
	} catch (err) {
		const isErrorInstance = err instanceof Error;
		const message = isErrorInstance ? err.message : String(err);
		const hints = errorHints(err, target);
		const cliError = renderCliError(message, hints);
		process.stderr.write(cliError);
		return 2;
	}
};
