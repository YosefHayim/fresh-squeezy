import type { Mode } from "@/client/environment.js";
import { createFreshSqueezyError } from "@/client/errors.js";
import type { Http, JsonApiResource } from "@/client/http.js";
import type {
	DiscountAttributes,
	LicenseKeyAttributes,
	ProductAttributes,
	StoreAttributes,
	VariantAttributes,
	WebhookAttributes,
} from "@/client/lemon-squeezy-types.js";
import { validateConnection } from "./connection.js";
import { validateDiscount } from "./discount.js";
import { fetchCollection, type Lookup } from "./fetch-resource.js";
import {
	type CheckName,
	type CheckReport,
	createCheckReport,
	type DoctorReport,
} from "./findings.js";
import { validateLicenseKey } from "./license-key.js";
import { validateProduct } from "./product.js";
import { validateStore } from "./store.js";
import { validateSubscriptionPlan } from "./subscription-plan.js";
import { validateWebhook } from "./webhook.js";

export interface DoctorTargets {
	storeId?: string;
	allResources?: boolean;
	productIds?: string[];
	variantIds?: string[];
	webhookUrls?: string[];
	discountIds?: string[];
	licenseKeyIds?: string[];
}

interface Listing<Attributes> {
	name: CheckName;
	noun: string;
	lookup: Lookup<JsonApiResource<Attributes>[]>;
}

type PendingCheck = () => Promise<CheckReport>;

const dropDuplicates = (ids: string[]) => [...new Set(ids)];

const pickListedResources = <Attributes>(
	listing: Listing<Attributes>,
): JsonApiResource<Attributes>[] => {
	const { lookup } = listing;
	const isFailed = lookup.kind === "failed";
	if (isFailed) return [];
	return lookup.resource;
};

const pickListedIds = <Attributes>(listing: Listing<Attributes>) =>
	pickListedResources(listing).map((resource) => resource.id);

const fetchListing = async <Attributes>(
	http: Http,
	listing: Omit<Listing<Attributes>, "lookup"> & {
		path: string;
		query: Record<string, string>;
	},
): Promise<Listing<Attributes>> => {
	const { name, noun, path, query } = listing;
	const lookup = await fetchCollection<Attributes>(http, { path, query });
	return { name, noun, lookup };
};

const reportListingFailure = (
	mode: Mode,
	storeId: string,
	listing: Listing<unknown>,
) => {
	const { lookup, name, noun } = listing;
	const isListed = lookup.kind === "found";
	if (isListed) return [];
	const target = { label: `${noun} of store ${storeId}` };
	return [
		createCheckReport({ name, mode, findings: [lookup.finding], target }),
	];
};

const fetchVariantListing = (
	http: Http,
	product: JsonApiResource<ProductAttributes>,
) =>
	fetchListing<VariantAttributes>(http, {
		name: "subscriptionPlan",
		noun: `plans of product ${product.id}, listed for`,
		path: "/v1/variants",
		query: { "filter[product_id]": product.id },
	});

const listStoreResources = async (http: Http, storeId: string) => {
	const storeQuery = { "filter[store_id]": storeId };
	const [products, webhooks, discounts, licenseKeys] = await Promise.all([
		fetchListing<ProductAttributes>(http, {
			name: "product",
			noun: "products",
			path: "/v1/products",
			query: storeQuery,
		}),
		fetchListing<WebhookAttributes>(http, {
			name: "webhook",
			noun: "webhooks",
			path: "/v1/webhooks",
			query: storeQuery,
		}),
		fetchListing<DiscountAttributes>(http, {
			name: "discount",
			noun: "discounts",
			path: "/v1/discounts",
			query: storeQuery,
		}),
		fetchListing<LicenseKeyAttributes>(http, {
			name: "licenseKey",
			noun: "license keys",
			path: "/v1/license-keys",
			query: storeQuery,
		}),
	]);
	const listedProducts = pickListedResources(products);
	const variantFetches = listedProducts.map((product) =>
		fetchVariantListing(http, product),
	);
	const variantListings = await Promise.all(variantFetches);
	const variants = variantListings.flatMap(pickListedResources);
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
		productIds: pickListedIds(products),
		variantIds: subscriptionPlans.map((plan) => plan.id),
		webhookUrls: pickListedResources(webhooks).map(
			(webhook) => webhook.attributes.url,
		),
		discountIds: pickListedIds(discounts),
		licenseKeyIds: pickListedIds(licenseKeys),
		failedListings,
	};
};

const assertStoreGivenForDependents = (
	storeId: string | undefined,
	dependentTargets: Record<string, unknown[]>,
) => {
	const isStoreGiven = storeId !== undefined;
	if (isStoreGiven) return;
	const givenTargetNames = Object.entries(dependentTargets)
		.filter(([, targets]) => targets.length > 0)
		.map(([targetName]) => targetName);
	const isNoTargetGiven = givenTargetNames.length === 0;
	if (isNoTargetGiven) return;
	throw createFreshSqueezyError({
		code: "DOCTOR_TARGETS_INVALID",
		message: `doctor() received ${givenTargetNames.join(", ")} without storeId. These checks cannot run without a store; pass \`storeId\` or remove the dependent targets.`,
	});
};

export const listStoreIds = async (http: Http) => {
	const storesLookup = await fetchCollection<StoreAttributes>(http, {
		path: "/v1/stores",
	});
	const isFetchFailed = storesLookup.kind === "failed";
	if (isFetchFailed) {
		const { code, message } = storesLookup.finding;
		throw createFreshSqueezyError({ code, message });
	}
	const stores = storesLookup.resource;
	const hasNoStores = stores.length === 0;
	if (hasNoStores) {
		throw createFreshSqueezyError({
			code: "NO_STORES",
			message: "No stores reachable with this API key.",
		});
	}
	return stores.map((store) => store.id);
};

interface StoreTargets {
	productIds: string[];
	variantIds: string[];
	webhookUrls: string[];
	discountIds: string[];
	licenseKeyIds: string[];
}

const mergeTargets = (
	givenTargets: DoctorTargets,
	discoveredTargets: StoreTargets | null,
): StoreTargets => {
	const { productIds = [], variantIds = [], webhookUrls = [] } = givenTargets;
	const { discountIds = [], licenseKeyIds = [] } = givenTargets;
	return {
		productIds: dropDuplicates([
			...productIds,
			...(discoveredTargets?.productIds ?? []),
		]),
		variantIds: dropDuplicates([
			...variantIds,
			...(discoveredTargets?.variantIds ?? []),
		]),
		webhookUrls: dropDuplicates([
			...webhookUrls,
			...(discoveredTargets?.webhookUrls ?? []),
		]),
		discountIds: dropDuplicates([
			...discountIds,
			...(discoveredTargets?.discountIds ?? []),
		]),
		licenseKeyIds: dropDuplicates([
			...licenseKeyIds,
			...(discoveredTargets?.licenseKeyIds ?? []),
		]),
	};
};

interface StoreCheckPlan {
	http: Http;
	mode: Mode;
	storeId: string;
	targets: StoreTargets;
}

const listPendingChecks = ({
	http,
	mode,
	storeId,
	targets,
}: StoreCheckPlan): PendingCheck[] => {
	const productChecks = targets.productIds.map(
		(productId) => () =>
			validateProduct(http, mode, { productId, expectedStoreId: storeId }),
	);
	const webhookChecks = targets.webhookUrls.map(
		(url) => () => validateWebhook(http, mode, { storeId, url }),
	);
	const discountChecks = targets.discountIds.map(
		(discountId) => () => validateDiscount(http, mode, { storeId, discountId }),
	);
	const licenseKeyChecks = targets.licenseKeyIds.map(
		(licenseKeyId) => () =>
			validateLicenseKey(http, mode, { storeId, licenseKeyId }),
	);
	const planChecks = targets.variantIds.map(
		(variantId) => () =>
			validateSubscriptionPlan(http, mode, { storeId, variantId }),
	);
	const storeCheck = () => validateStore(http, mode, storeId);
	return [
		storeCheck,
		...productChecks,
		...webhookChecks,
		...discountChecks,
		...licenseKeyChecks,
		...planChecks,
	];
};

const runChecksInOrder = async (pendingChecks: PendingCheck[]) => {
	const checkReports: CheckReport[] = [];
	for (const runCheck of pendingChecks) {
		const checkReport = await runCheck();
		checkReports.push(checkReport);
	}
	return checkReports;
};

export const doctor = async (
	http: Http,
	mode: Mode,
	targets: DoctorTargets = {},
): Promise<DoctorReport> => {
	const { storeId, allResources = false } = targets;
	assertStoreGivenForDependents(storeId, {
		allResources: allResources ? [true] : [],
		productIds: targets.productIds ?? [],
		variantIds: targets.variantIds ?? [],
		webhookUrls: targets.webhookUrls ?? [],
		discountIds: targets.discountIds ?? [],
		licenseKeyIds: targets.licenseKeyIds ?? [],
	});

	const connectionReport = await validateConnection(http, mode);
	const isConnectionFailed = !connectionReport.ok;
	const isStoreMissing = storeId === undefined;
	if (isConnectionFailed || isStoreMissing) {
		return { ok: connectionReport.ok, mode, checks: [connectionReport] };
	}

	const discoveredTargets = allResources
		? await listStoreResources(http, storeId)
		: null;
	const failedListings = discoveredTargets?.failedListings ?? [];
	const listingFailures = failedListings.flatMap((listing) =>
		reportListingFailure(mode, storeId, listing),
	);
	const storeTargets = mergeTargets(targets, discoveredTargets);
	const pendingChecks = listPendingChecks({
		http,
		mode,
		storeId,
		targets: storeTargets,
	});
	const storeCheckReports = await runChecksInOrder(pendingChecks);
	const checks = [connectionReport, ...listingFailures, ...storeCheckReports];
	const isEveryCheckOk = checks.every((check) => check.ok);
	return { ok: isEveryCheckOk, mode, checks };
};
