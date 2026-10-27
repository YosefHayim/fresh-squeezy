import type { Mode } from "@/shared/config.js";
import type { Http } from "@/shared/http.js";
import type {
	ProductAttributes,
	VariantAttributes,
} from "@/shared/lemon-squeezy-types.js";
import { fetchResource, storeMismatchFindings } from "./fetch-resource.js";
import {
	buildResult,
	FINDING_CODES,
	type Finding,
	type FindingRule,
	findingsFrom,
	type ValidationResult,
} from "./findings.js";

export interface SubscriptionPlanCheck {
	storeId: string;
	variantId: string;
}

export interface SubscriptionPlanSummary {
	variantId: string;
	interval: string | null;
	intervalCount: number | null;
	price: number;
	hasFreeTrial: boolean;
	status: string;
}

type PlanSubject = VariantAttributes & { variantId: string };

const VALID_INTERVALS = new Set(["day", "week", "month", "year"]);

const isNotSubscription = (plan: PlanSubject) => !plan.is_subscription;

const hasInvalidInterval = ({ interval }: PlanSubject) =>
	!interval || !VALID_INTERVALS.has(interval);

const hasInvalidIntervalCount = ({
	interval_count: intervalCount,
}: PlanSubject) => typeof intervalCount !== "number" || intervalCount <= 0;

const hasFreePrice = (plan: PlanSubject) =>
	plan.price === 0 && plan.is_subscription;

const hasBrokenTrial = (plan: PlanSubject) => {
	const isTrialMissingInterval = !plan.trial_interval;
	const isTrialCountMissing = (plan.trial_interval_count ?? 0) <= 0;
	return plan.has_free_trial && (isTrialMissingInterval || isTrialCountMissing);
};

const isDraft = (plan: PlanSubject) => plan.status === "draft";

const PLAN_RULES: FindingRule<PlanSubject>[] = [
	{
		code: FINDING_CODES.PLAN_NOT_SUBSCRIPTION,
		severity: "error",
		when: isNotSubscription,
		message: (plan) =>
			`Variant ${plan.variantId} is not a subscription variant (is_subscription is false).`,
		suggestedFix:
			"Use a variant that has subscription billing enabled, or use the regular variant validator.",
		context: (plan) => ({ variantId: plan.variantId }),
	},
	{
		code: FINDING_CODES.PLAN_INVALID_INTERVAL,
		severity: "error",
		when: hasInvalidInterval,
		message: (plan) =>
			`Subscription variant has invalid interval: "${plan.interval ?? "missing"}". Expected one of: day, week, month, year.`,
		suggestedFix: "Set a valid billing interval in the variant configuration.",
		context: (plan) => ({ interval: plan.interval ?? null }),
	},
	{
		code: FINDING_CODES.PLAN_INVALID_INTERVAL,
		severity: "error",
		when: hasInvalidIntervalCount,
		message: (plan) =>
			`Subscription variant has invalid interval_count: ${plan.interval_count ?? "missing"}. Must be a positive integer.`,
		suggestedFix:
			"Set interval_count to a positive value (e.g. 1 for monthly, 2 for biweekly).",
		context: (plan) => ({ intervalCount: plan.interval_count ?? null }),
	},
	{
		code: FINDING_CODES.PLAN_FREE_PRICE,
		severity: "warning",
		when: hasFreePrice,
		message:
			"Subscription variant has a price of 0 — this is almost always a misconfiguration for paid plans.",
		suggestedFix:
			"Set the variant price to the intended amount in cents, or confirm this is intentionally free.",
		context: (plan) => ({ price: plan.price }),
	},
	{
		code: FINDING_CODES.PLAN_TRIAL_INCONSISTENT,
		severity: "warning",
		when: hasBrokenTrial,
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
		code: FINDING_CODES.PLAN_DRAFT,
		severity: "warning",
		when: isDraft,
		message:
			"Subscription variant is in draft status — customers cannot subscribe.",
		suggestedFix: "Publish the variant in the Lemon Squeezy dashboard.",
		context: (plan) => ({ status: plan.status }),
	},
];

const summaryOf = (
	variantId: string,
	plan: VariantAttributes,
): SubscriptionPlanSummary => ({
	variantId,
	interval: plan.interval,
	intervalCount: plan.interval_count,
	price: plan.price,
	hasFreeTrial: plan.has_free_trial,
	status: plan.status,
});

const storeFindingsOf = async (
	http: Http,
	storeId: string,
	productId: number,
): Promise<Finding[]> => {
	const fetched = await fetchResource<ProductAttributes>(http, {
		path: `/v1/products/${productId}`,
		notFound: {
			code: FINDING_CODES.PRODUCT_NOT_FOUND,
			message: `Product ${productId} not found.`,
		},
	});
	// Advisory only: a failed product fetch skips the store check instead of blocking the plan checks.
	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) return [];
	return storeMismatchFindings({
		label: `Subscription variant (via product ${productId})`,
		code: FINDING_CODES.PLAN_STORE_MISMATCH,
		expectedStoreId: storeId,
		actualStoreId: fetched.payload.store_id,
		suggestedFix:
			"Use the correct store ID or variant ID — plans should not cross stores.",
		extraContext: { productId: String(productId) },
	});
};

export const validateSubscriptionPlan = async (
	http: Http,
	mode: Mode,
	{ storeId, variantId }: SubscriptionPlanCheck,
): Promise<ValidationResult<SubscriptionPlanSummary>> => {
	const fetched = await fetchResource<VariantAttributes>(http, {
		path: `/v1/variants/${variantId}`,
		notFound: {
			code: FINDING_CODES.PLAN_VARIANT_NOT_FOUND,
			message: `Variant ${variantId} not found.`,
			suggestedFix: "Verify the variant ID in the Lemon Squeezy dashboard.",
			context: { variantId },
		},
	});

	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) {
		return buildResult({
			name: "subscriptionPlan",
			mode,
			findings: [fetched.finding],
			target: { label: `variant ${variantId}`, id: variantId },
		});
	}

	const plan = fetched.payload;
	const planFindings = findingsFrom(PLAN_RULES, { ...plan, variantId });
	const storeFindings = await storeFindingsOf(http, storeId, plan.product_id);
	return buildResult({
		name: "subscriptionPlan",
		mode,
		findings: [...planFindings, ...storeFindings],
		resource: summaryOf(variantId, plan),
		target: { label: plan.name, id: variantId },
	});
};
