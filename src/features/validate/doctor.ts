import type { Mode } from "@/shared/config.js";
import { freshSqueezyErrorOf } from "@/shared/errors.js";
import type { Http, JsonApiResource } from "@/shared/http.js";
import type {
	DiscountAttributes,
	LicenseKeyAttributes,
	ProductAttributes,
	StoreAttributes,
	VariantAttributes,
	WebhookAttributes,
} from "@/shared/lemon-squeezy-types.js";
import { validateConnection } from "./connection.js";
import { validateDiscount } from "./discount.js";
import { type Fetched, fetchCollection } from "./fetch-resource.js";
import {
	buildResult,
	type DoctorReport,
	type ValidationResult,
	type ValidatorName,
} from "./findings.js";
import { validateLicenseKey } from "./license-key.js";
import { validateProduct } from "./product.js";
import { validateStore } from "./store.js";
import { validateSubscriptionPlan } from "./subscription-plan.js";
import { validateWebhook } from "./webhook.js";

export interface DoctorOptions {
	storeId?: string;
	allResources?: boolean;
	productIds?: string[];
	variantIds?: string[];
	webhookUrls?: string[];
	discountIds?: string[];
	licenseKeyIds?: string[];
}

interface Listing<Attributes> {
	name: ValidatorName;
	noun: string;
	fetched: Fetched<JsonApiResource<Attributes>[]>;
}

type Job = () => Promise<ValidationResult>;

const uniqueValues = (values: string[]) => [...new Set(values)];

const resourcesOf = <Attributes>(
	listing: Listing<Attributes>,
): JsonApiResource<Attributes>[] => {
	const { fetched } = listing;
	const isFailed = fetched.kind === "failed";
	if (isFailed) return [];
	return fetched.payload;
};

const idsOf = <Attributes>(listing: Listing<Attributes>) =>
	resourcesOf(listing).map((resource) => resource.id);

const listingOf = async <Attributes>(
	http: Http,
	listing: Omit<Listing<Attributes>, "fetched"> & {
		path: string;
		query: Record<string, string>;
	},
): Promise<Listing<Attributes>> => {
	const { name, noun, path, query } = listing;
	const fetched = await fetchCollection<Attributes>(http, { path, query });
	return { name, noun, fetched };
};

const listingFailureResults = (
	mode: Mode,
	storeId: string,
	listing: Listing<unknown>,
) => {
	const { fetched, name, noun } = listing;
	const isListed = fetched.kind === "found";
	if (isListed) return [];
	const target = { label: `${noun} of store ${storeId}` };
	return [buildResult({ name, mode, findings: [fetched.finding], target })];
};

const listStoreResources = async (http: Http, storeId: string) => {
	const storeQuery = { "filter[store_id]": storeId };
	const [products, webhooks, discounts, licenseKeys] = await Promise.all([
		listingOf<ProductAttributes>(http, {
			name: "product",
			noun: "products",
			path: "/v1/products",
			query: storeQuery,
		}),
		listingOf<WebhookAttributes>(http, {
			name: "webhook",
			noun: "webhooks",
			path: "/v1/webhooks",
			query: storeQuery,
		}),
		listingOf<DiscountAttributes>(http, {
			name: "discount",
			noun: "discounts",
			path: "/v1/discounts",
			query: storeQuery,
		}),
		listingOf<LicenseKeyAttributes>(http, {
			name: "licenseKey",
			noun: "license keys",
			path: "/v1/license-keys",
			query: storeQuery,
		}),
	]);
	const listVariants = (product: JsonApiResource<ProductAttributes>) =>
		listingOf<VariantAttributes>(http, {
			name: "subscriptionPlan",
			noun: `plans of product ${product.id}, listed for`,
			path: "/v1/variants",
			query: { "filter[product_id]": product.id },
		});
	const listedProducts = resourcesOf(products);
	const variantJobs = listedProducts.map(listVariants);
	const variantListings = await Promise.all(variantJobs);
	const variants = variantListings.flatMap(resourcesOf);
	const subscriptionPlans = variants.filter(
		(variant) => variant.attributes.is_subscription,
	);
	const failedListings: Listing<unknown>[] = [
		products,
		webhooks,
		discounts,
		licenseKeys,
		...variantListings,
	];
	return {
		productIds: idsOf(products),
		variantIds: subscriptionPlans.map((plan) => plan.id),
		webhookUrls: resourcesOf(webhooks).map((webhook) => webhook.attributes.url),
		discountIds: idsOf(discounts),
		licenseKeyIds: idsOf(licenseKeys),
		failedListings,
	};
};

const assertStoreGivenForDependents = (
	storeId: string | undefined,
	dependentValues: Record<string, unknown[]>,
) => {
	const isStoreGiven = storeId !== undefined;
	if (isStoreGiven) return;
	const dependentNames = Object.entries(dependentValues)
		.filter(([, values]) => values.length > 0)
		.map(([name]) => name);
	const isEverythingCoherent = dependentNames.length === 0;
	if (isEverythingCoherent) return;
	throw freshSqueezyErrorOf({
		code: "DOCTOR_OPTIONS_INVALID",
		message: `doctor() received ${dependentNames.join(", ")} without storeId. These validators cannot run without a store; pass \`storeId\` or remove the dependent options.`,
	});
};

export const listStoreIds = async (http: Http) => {
	const fetched = await fetchCollection<StoreAttributes>(http, {
		path: "/v1/stores",
	});
	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) {
		const { code, message } = fetched.finding;
		throw freshSqueezyErrorOf({ code, message });
	}
	const stores = fetched.payload;
	const hasNoStores = stores.length === 0;
	if (hasNoStores) {
		throw freshSqueezyErrorOf({
			code: "NO_STORES",
			message: "No stores reachable with this API key.",
		});
	}
	return stores.map((store) => store.id);
};

interface StoreChecks {
	productIds: string[];
	variantIds: string[];
	webhookUrls: string[];
	discountIds: string[];
	licenseKeyIds: string[];
}

const checksOf = (
	options: DoctorOptions,
	discovered?: StoreChecks,
): StoreChecks => {
	const { productIds = [], variantIds = [], webhookUrls = [] } = options;
	const { discountIds = [], licenseKeyIds = [] } = options;
	return {
		productIds: uniqueValues([
			...productIds,
			...(discovered?.productIds ?? []),
		]),
		variantIds: uniqueValues([
			...variantIds,
			...(discovered?.variantIds ?? []),
		]),
		webhookUrls: uniqueValues([
			...webhookUrls,
			...(discovered?.webhookUrls ?? []),
		]),
		discountIds: uniqueValues([
			...discountIds,
			...(discovered?.discountIds ?? []),
		]),
		licenseKeyIds: uniqueValues([
			...licenseKeyIds,
			...(discovered?.licenseKeyIds ?? []),
		]),
	};
};

const jobsOf = (
	http: Http,
	mode: Mode,
	storeId: string,
	checks: StoreChecks,
): Job[] => {
	const productJobs = checks.productIds.map(
		(productId) => () =>
			validateProduct(http, mode, { productId, expectedStoreId: storeId }),
	);
	const webhookJobs = checks.webhookUrls.map(
		(url) => () => validateWebhook(http, mode, { storeId, url }),
	);
	const discountJobs = checks.discountIds.map(
		(discountId) => () => validateDiscount(http, mode, { storeId, discountId }),
	);
	const licenseKeyJobs = checks.licenseKeyIds.map(
		(licenseKeyId) => () =>
			validateLicenseKey(http, mode, { storeId, licenseKeyId }),
	);
	const planJobs = checks.variantIds.map(
		(variantId) => () =>
			validateSubscriptionPlan(http, mode, { storeId, variantId }),
	);
	const storeJob = () => validateStore(http, mode, storeId);
	return [
		storeJob,
		...productJobs,
		...webhookJobs,
		...discountJobs,
		...licenseKeyJobs,
		...planJobs,
	];
};

const runInOrder = async (jobs: Job[]) => {
	const results: ValidationResult[] = [];
	for (const runJob of jobs) {
		const jobResult = await runJob();
		results.push(jobResult);
	}
	return results;
};

export const doctor = async (
	http: Http,
	mode: Mode,
	options: DoctorOptions = {},
): Promise<DoctorReport> => {
	const { storeId, allResources = false } = options;
	assertStoreGivenForDependents(storeId, {
		allResources: allResources ? [true] : [],
		productIds: options.productIds ?? [],
		variantIds: options.variantIds ?? [],
		webhookUrls: options.webhookUrls ?? [],
		discountIds: options.discountIds ?? [],
		licenseKeyIds: options.licenseKeyIds ?? [],
	});

	const connection = await validateConnection(http, mode);
	const isConnectionFailed = !connection.ok;
	const isStoreMissing = storeId === undefined;
	if (isConnectionFailed || isStoreMissing) {
		return { ok: connection.ok, mode, results: [connection] };
	}

	const discovered = allResources
		? await listStoreResources(http, storeId)
		: undefined;
	const failedListings = discovered?.failedListings ?? [];
	const listingFailures = failedListings.flatMap((listing) =>
		listingFailureResults(mode, storeId, listing),
	);
	const checks = checksOf(options, discovered);
	const jobs = jobsOf(http, mode, storeId, checks);
	const jobResults = await runInOrder(jobs);
	const results = [connection, ...listingFailures, ...jobResults];
	const isEveryResultOk = results.every((entry) => entry.ok);
	return { ok: isEveryResultOk, mode, results };
};
