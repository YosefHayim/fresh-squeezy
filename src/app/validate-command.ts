import type { DoctorCommandOptions } from "@/app/doctor-command.js";
import {
	MISSING_API_KEY_HINTS,
	renderResult,
	writeCliFailure,
} from "@/app/render.js";
import { resolveStores } from "@/app/resolve-stores.js";
import {
	createFreshSqueezy,
	type FreshSqueezyClient,
} from "@/create-fresh-squeezy.js";
import type { ValidationResult } from "@/shared/contracts.js";
import { freshSqueezyErrorOf, isFreshSqueezyError } from "@/shared/errors.js";

export type ValidateCommandOptions = Omit<DoctorCommandOptions, "allResources">;

export interface ValidateSubcommandSpec {
	description: string;
	stores: "none" | "multi" | "ownership";
	storeIdsHelp?: string;
	required?: [flag: string, description: string];
	examples: string[];
	// Method form: each target narrows the options to the flags commander requires for it.
	run(
		client: FreshSqueezyClient,
		options: ValidateCommandOptions,
	): Promise<ValidationResult | ValidationResult[]>;
}

type WithRequired<Flag extends keyof ValidateCommandOptions> =
	ValidateCommandOptions & Required<Pick<ValidateCommandOptions, Flag>>;

const EXAMPLE_WEBHOOK_URL =
	"https://app.example.com/api/webhooks/lemon-squeezy";

const requiredStoreId = (
	options: ValidateCommandOptions,
	target: string,
): string => {
	const [storeId] = options.storeIds ?? [];
	const isStoreIdMissing = !storeId;
	if (isStoreIdMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: `--store-ids is required for \`validate ${target}\`.`,
		});
	}
	return storeId;
};

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
		run: (client, options: WithRequired<"productId">) =>
			client.validateProduct({
				productId: options.productId,
				expectedStoreId: options.storeIds?.[0],
			}),
	},
	webhook: {
		description: "Check a webhook is registered with the recommended events",
		stores: "multi",
		required: ["--webhook-url <url>", "Public webhook URL"],
		examples: [
			`fresh-squeezy validate webhook --store-ids 12 --webhook-url ${EXAMPLE_WEBHOOK_URL}`,
			`fresh-squeezy validate webhook --all-stores --webhook-url ${EXAMPLE_WEBHOOK_URL}`,
		],
		run: async (client, options: WithRequired<"webhookUrl">) => {
			const storeIds = await resolveStoresForSubcommand(
				client,
				"webhook",
				options,
			);
			const webhookValidations = storeIds.map((storeId) =>
				client.validateWebhook({ storeId, url: options.webhookUrl }),
			);
			return Promise.all(webhookValidations);
		},
	},
	discount: {
		description: "Check a discount code is valid and redeemable",
		stores: "ownership",
		required: ["--discount-id <id>", "Discount ID to validate"],
		examples: [
			"fresh-squeezy validate discount --store-ids 12 --discount-id 123",
		],
		run: (client, options: WithRequired<"discountId">) => {
			const storeId = requiredStoreId(options, "discount");
			return client.validateDiscount({
				discountId: options.discountId,
				storeId,
			});
		},
	},
	"license-key": {
		description:
			"Check a license key is active and not at its activation limit",
		stores: "ownership",
		required: ["--license-key-id <id>", "License key ID to validate"],
		examples: [
			"fresh-squeezy validate license-key --store-ids 12 --license-key-id 123",
		],
		run: (client, options: WithRequired<"licenseKeyId">) => {
			const storeId = requiredStoreId(options, "license-key");
			return client.validateLicenseKey({
				licenseKeyId: options.licenseKeyId,
				storeId,
			});
		},
	},
	"subscription-plan": {
		description:
			"Check a subscription plan variant has valid billing interval and trial config",
		stores: "ownership",
		required: ["--variant-id <id>", "Variant ID of the subscription plan"],
		examples: [
			"fresh-squeezy validate subscription-plan --store-ids 12 --variant-id 123",
		],
		run: (client, options: WithRequired<"variantId">) => {
			const storeId = requiredStoreId(options, "subscription-plan");
			return client.validateSubscriptionPlan({
				variantId: options.variantId,
				storeId,
			});
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
		const subcommand: ValidateSubcommandSpec = VALIDATE_SUBCOMMANDS[target];
		const results = await subcommand.run(client, options);
		return writeResults(results, options);
	} catch (err) {
		const hints = errorHints(err, target);
		writeCliFailure(err, { hints });
		return 2;
	}
};
