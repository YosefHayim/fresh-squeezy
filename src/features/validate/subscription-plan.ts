import type {
	ProductAttributes,
	SubscriptionVariantAttributes,
} from "@/shared/attributes.js";
import type {
	Mode,
	ResourceId,
	ValidationIssue,
	ValidationResult,
} from "@/shared/contracts.js";
import type { HttpClient } from "@/shared/http.js";
import {
	buildResult,
	failedResult,
	ISSUE_CODES,
	type IssueRule,
	issuesOf,
} from "./issues.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";

export interface SubscriptionPlanValidationOptions {
	storeId: ResourceId;
	variantId: ResourceId;
}

export interface SubscriptionPlanSummary {
	variantId: string;
	interval: string | null;
	intervalCount: number | null;
	price: number;
	hasFreeTrial: boolean;
	status: string;
}

const VALID_INTERVALS = new Set(["day", "week", "month", "year"]);

const fetchVariant = (http: HttpClient, variantId: ResourceId) => {
	return probeFetch(
		() =>
			http.getResource<SubscriptionVariantAttributes>(
				`/v1/variants/${variantId}`,
			),
		{
			code: ISSUE_CODES.PLAN_VARIANT_NOT_FOUND,
			message: `Variant ${variantId} not found.`,
			suggestedFix: "Verify the variant ID in the Lemon Squeezy dashboard.",
			context: { variantId: String(variantId) },
		},
	);
};

// Advisory only: skip on a failed product fetch rather than blocking the attribute checks.
const checkPlanStoreOwnership = async (
	http: HttpClient,
	storeId: ResourceId,
	productId: ResourceId,
): Promise<ValidationIssue[]> => {
	const productProbed = await probeFetch(
		() => http.getResource<ProductAttributes>(`/v1/products/${productId}`),
		{
			code: ISSUE_CODES.PRODUCT_NOT_FOUND,
			message: `Product ${productId} not found.`,
		},
	);
	const isProductMissing = !productProbed.ok;
	if (isProductMissing) return [];
	return checkStoreOwnership({
		expectedStoreId: storeId,
		actualStoreId: productProbed.resource.attributes.store_id,
		code: ISSUE_CODES.PLAN_STORE_MISMATCH,
		label: `Subscription variant (via product ${productId})`,
		suggestedFix:
			"Use the correct store ID or variant ID — plans should not cross stores.",
		extraContext: { productId: String(productId) },
	});
};

const summarizePlan = (
	variantId: string,
	attributes: SubscriptionVariantAttributes,
): SubscriptionPlanSummary => ({
	variantId,
	interval: attributes.interval,
	intervalCount: attributes.interval_count,
	price: attributes.price,
	hasFreeTrial: attributes.has_free_trial,
	status: attributes.status,
});

export const validateSubscriptionPlan = async (
	http: HttpClient,
	mode: Mode,
	options: SubscriptionPlanValidationOptions,
): Promise<ValidationResult<SubscriptionPlanSummary>> => {
	const { storeId, variantId } = options;
	const target = { label: `variant ${variantId}`, id: String(variantId) };

	const fetched = await fetchVariant(http, variantId);
	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return failedResult("subscriptionPlan", mode, fetched.issue, target);
	}

	const { id, attributes } = fetched.resource;
	const planIssues = checkSubscriptionPlan(attributes, { variantId });
	const ownershipIssues = await checkPlanStoreOwnership(
		http,
		storeId,
		attributes.product_id,
	);

	const summary = summarizePlan(id, attributes);

	return buildResult(
		"subscriptionPlan",
		mode,
		[...planIssues, ...ownershipIssues],
		summary,
		{ label: attributes.name, id: String(variantId) },
	);
};

type PlanSubject = SubscriptionVariantAttributes & {
	variantId: ResourceId;
};

const planIssueRules: IssueRule<PlanSubject>[] = [
	{
		code: ISSUE_CODES.PLAN_NOT_SUBSCRIPTION,
		severity: "error",
		isRaised: (plan) => !plan.is_subscription,
		message: (plan) =>
			`Variant ${plan.variantId} is not a subscription variant (is_subscription is false).`,
		suggestedFix:
			"Use a variant that has subscription billing enabled, or use the regular variant validator.",
		context: (plan) => ({ variantId: String(plan.variantId) }),
	},
	{
		code: ISSUE_CODES.PLAN_INVALID_INTERVAL,
		severity: "error",
		isRaised: ({ interval }) => !interval || !VALID_INTERVALS.has(interval),
		message: (plan) =>
			`Subscription variant has invalid interval: "${plan.interval ?? "missing"}". Expected one of: day, week, month, year.`,
		suggestedFix: "Set a valid billing interval in the variant configuration.",
		context: (plan) => ({ interval: plan.interval ?? null }),
	},
	{
		code: ISSUE_CODES.PLAN_INVALID_INTERVAL,
		severity: "error",
		isRaised: ({ interval_count }) =>
			interval_count === null || interval_count <= 0,
		message: (plan) =>
			`Subscription variant has invalid interval_count: ${plan.interval_count}. Must be a positive integer.`,
		suggestedFix:
			"Set interval_count to a positive value (e.g. 1 for monthly, 2 for biweekly).",
		context: (plan) => ({ intervalCount: plan.interval_count }),
	},
	{
		code: ISSUE_CODES.PLAN_FREE_PRICE,
		severity: "warning",
		isRaised: (plan) => plan.price === 0 && plan.is_subscription,
		message:
			"Subscription variant has a price of 0 — this is almost always a misconfiguration for paid plans.",
		suggestedFix:
			"Set the variant price to the intended amount in cents, or confirm this is intentionally free.",
		context: (plan) => ({ price: plan.price }),
	},
	{
		code: ISSUE_CODES.PLAN_TRIAL_INCONSISTENT,
		severity: "warning",
		isRaised: (plan) =>
			plan.has_free_trial &&
			(!plan.trial_interval || (plan.trial_interval_count ?? 0) <= 0),
		message: (plan) =>
			`Subscription variant has free trial enabled but trial interval is misconfigured (interval: "${plan.trial_interval ?? "missing"}", count: ${plan.trial_interval_count ?? 0}).`,
		suggestedFix:
			"Set a valid trial interval and count, or disable the free trial.",
		context: (plan) => ({
			trialInterval: plan.trial_interval ?? null,
			trialIntervalCount: plan.trial_interval_count ?? null,
		}),
	},
	{
		code: ISSUE_CODES.PLAN_DRAFT,
		severity: "warning",
		isRaised: (plan) => plan.status === "draft",
		message:
			"Subscription variant is in draft status — customers cannot subscribe.",
		suggestedFix: "Publish the variant in the Lemon Squeezy dashboard.",
		context: (plan) => ({ status: plan.status }),
	},
];

export const checkSubscriptionPlan = (
	attributes: SubscriptionVariantAttributes,
	options: { variantId: ResourceId },
): ValidationIssue[] =>
	issuesOf(planIssueRules, { ...attributes, variantId: options.variantId });
