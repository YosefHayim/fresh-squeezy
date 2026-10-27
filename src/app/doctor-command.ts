import {
	discoverChoices,
	OPTIONAL_VALIDATORS,
	type OptionalValidatorIds,
	type ResourceChoiceGroup,
} from "@/app/optional-validators.js";
import { getDoctorHints, renderReport, writeCliFailure } from "@/app/render.js";
import { resolveStores } from "@/app/resolve-stores.js";
import {
	createFreshSqueezy,
	type FreshSqueezyClient,
} from "@/create-fresh-squeezy.js";
import type { DoctorReport, Mode } from "@/shared/contracts.js";

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

interface DoctorJsonOutput {
	ok: boolean;
	mode: Mode;
	reports: DoctorReport[];
}

export const runDoctorCommand = async (
	options: DoctorCommandOptions,
): Promise<number> => {
	try {
		const client = createFreshSqueezy({ mode: options.mode });
		const resolved = await resolveStores(client, {
			storeIds: options.storeIds,
			allStores: options.allStores,
			isInteractive: options.isInteractive ?? false,
		});

		const wereStoresSkipped = resolved.skipped;
		if (wereStoresSkipped) {
			return await runConnectionOnly(client, options);
		}

		const runStoreDoctor = async (storeId: string): Promise<DoctorReport> => {
			const validatorIds = await resolveValidatorIds(client, storeId, options);
			return client.doctor({ storeId, ...validatorIds });
		};
		const reportJobs = resolved.storeIds.map(runStoreDoctor);
		const reports = await Promise.all(reportJobs);

		const areAllReportsOk = reports.every((report) => report.ok);
		const exitCode = areAllReportsOk ? 0 : 1;
		const payload: DoctorJsonOutput = {
			ok: areAllReportsOk,
			mode: client.mode,
			reports,
		};

		if (options.json) {
			const payloadText = JSON.stringify(payload, null, 2);
			process.stdout.write(`${payloadText}\n`);
			return exitCode;
		}

		for (const report of reports) {
			const reportText = renderReport(report);
			process.stdout.write(`${reportText}\n\n`);
		}
		const hasExplicitSelection = hasExplicitResourceSelection(options);
		const wereResourceChecksSkipped =
			!options.allResources && !hasExplicitSelection;
		if (wereResourceChecksSkipped) {
			process.stderr.write(
				"fresh-squeezy: resource checks were skipped; pass --all-resources or explicit resource flags to validate products, webhooks, discounts, license keys, and subscription plans.\n",
			);
		}

		return exitCode;
	} catch (err) {
		const hints = getDoctorHints(err);
		writeCliFailure(err, { json: options.json, hints });
		return 2;
	}
};

const singleItemList = (value: string | undefined): string[] | undefined =>
	value ? [value] : undefined;

const explicitValidatorIds = (
	options: DoctorCommandOptions,
): OptionalValidatorIds => ({
	productIds: singleItemList(options.productId),
	webhookUrls: singleItemList(options.webhookUrl),
	discountIds: singleItemList(options.discountId),
	licenseKeyIds: singleItemList(options.licenseKeyId),
	variantIds: singleItemList(options.variantId),
});

const choiceValues = (
	group: ResourceChoiceGroup | undefined,
): string[] | undefined => {
	const hasNoChoices = !group?.choices.length;
	if (hasNoChoices) return undefined;
	return group?.choices.map((choice) => choice.value);
};

const mergeValues = (
	explicit: string[] | undefined,
	discovered: string[] | undefined,
): string[] | undefined => {
	const allValues = [...(explicit ?? []), ...(discovered ?? [])];
	const uniqueValues = new Set(allValues);
	const merged = Array.from(uniqueValues);
	const isThereNothingMerged = merged.length === 0;
	if (isThereNothingMerged) return undefined;
	return merged;
};

const resolveValidatorIds = async (
	client: FreshSqueezyClient,
	storeId: string,
	options: DoctorCommandOptions,
): Promise<OptionalValidatorIds> => {
	const explicit = explicitValidatorIds(options);
	const isDiscoveryOff = !options.allResources;
	if (isDiscoveryOff) return explicit;

	const allNames = OPTIONAL_VALIDATORS.map((validator) => validator.name);
	const discovered = await discoverChoices(client, storeId, allNames);
	for (const validator of OPTIONAL_VALIDATORS) {
		const discoveryError = discovered[validator.name]?.error;
		const labelText = validator.label.toLowerCase();
		if (discoveryError) {
			process.stderr.write(
				`fresh-squeezy: discovery skipped ${labelText}: ${discoveryError}\n`,
			);
		}
	}
	const shouldPrintCounts = !options.json;
	if (shouldPrintCounts) {
		const countTexts = OPTIONAL_VALIDATORS.map((validator) => {
			const labelText = validator.label.toLowerCase();
			const choiceCount = discovered[validator.name]?.choices.length ?? 0;
			return `${labelText} ${choiceCount}`;
		});
		const counts = countTexts.join(", ");
		process.stderr.write(
			`fresh-squeezy: discovered store ${storeId} resources: ${counts}.\n`,
		);
	}

	const mergedIds: OptionalValidatorIds = {};
	for (const validator of OPTIONAL_VALIDATORS) {
		const discoveredValues = choiceValues(discovered[validator.name]);
		mergedIds[validator.field] = mergeValues(
			explicit[validator.field],
			discoveredValues,
		);
	}
	return mergedIds;
};

const hasExplicitResourceSelection = (
	options: DoctorCommandOptions,
): boolean => {
	const explicitIds = explicitValidatorIds(options);
	return Object.values(explicitIds).some((ids) => ids !== undefined);
};

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
	const payload: DoctorJsonOutput = {
		ok: connection.ok,
		mode: client.mode,
		reports: [report],
	};

	const exitCode = connection.ok ? 0 : 1;
	if (options.json) {
		const payloadText = JSON.stringify(payload, null, 2);
		process.stdout.write(`${payloadText}\n`);
		return exitCode;
	}
	process.stderr.write(
		"fresh-squeezy: no --store-ids or --all-stores and stdin is not a TTY; running connection-only.\n",
	);
	const reportText = renderReport(report);
	process.stdout.write(`${reportText}\n`);
	return exitCode;
};
