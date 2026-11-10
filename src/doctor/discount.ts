import type { Mode } from "@/client/environment.js";
import type { Http } from "@/client/http.js";
import type { DiscountAttributes } from "@/client/lemon-squeezy-types.js";
import {
	createFailedLookupReport,
	fetchResource,
	listStoreMismatchFindings,
} from "./fetch-resource.js";
import {
	type CheckReport,
	createCheckReport,
	FINDING_CODES,
	type FindingRule,
	raiseFindings,
} from "./findings.js";
import { isExpired } from "./is-expired.js";

export interface DiscountCheck {
	storeId: string;
	discountId: string;
}

const isDraft = (discount: DiscountAttributes) => discount.status === "draft";

const isNotStarted = (startsAt: string | null, now: Date) => {
	const isStartSet = startsAt != null;
	return isStartSet && Date.parse(startsAt) > now.getTime();
};

const isOutOfRedemptions = (discount: DiscountAttributes) =>
	discount.is_limited_redemptions && discount.max_redemptions <= 0;

const isAmountNotPositive = (discount: DiscountAttributes) =>
	discount.amount <= 0;

const isPercentOverHundred = (discount: DiscountAttributes) =>
	discount.amount_type === "percent" && discount.amount > 100;

const createDiscountRules = (
	now: Date,
): FindingRule<DiscountAttributes>[] => [
	{
		code: FINDING_CODES.DISCOUNT_DRAFT,
		severity: "warning",
		when: isDraft,
		message: (discount) =>
			`Discount "${discount.name}" is in draft status — customers cannot redeem it.`,
		suggestedFix:
			"Publish the discount in the Lemon Squeezy dashboard before sharing the code.",
		details: (discount) => ({ name: discount.name, code: discount.code }),
	},
	{
		code: FINDING_CODES.DISCOUNT_EXPIRED,
		severity: "error",
		when: (discount) => isExpired(discount.expires_at, now),
		message: (discount) =>
			`Discount "${discount.name}" expired at ${discount.expires_at}.`,
		suggestedFix: "Extend the expiration date or create a new discount.",
		details: (discount) => ({
			name: discount.name,
			expiresAt: discount.expires_at,
		}),
	},
	{
		code: FINDING_CODES.DISCOUNT_NOT_STARTED,
		severity: "warning",
		when: (discount) => isNotStarted(discount.starts_at, now),
		message: (discount) =>
			`Discount "${discount.name}" starts at ${discount.starts_at} — not yet active.`,
		suggestedFix: "Wait for the start date or adjust it in the dashboard.",
		details: (discount) => ({
			name: discount.name,
			startsAt: discount.starts_at,
		}),
	},
	{
		code: FINDING_CODES.DISCOUNT_REDEMPTIONS_EXHAUSTED,
		severity: "warning",
		when: isOutOfRedemptions,
		message: (discount) =>
			`Discount "${discount.name}" has limited redemptions with max_redemptions ≤ 0.`,
		suggestedFix: "Increase max_redemptions or disable the redemption limit.",
		details: (discount) => ({
			name: discount.name,
			maxRedemptions: discount.max_redemptions,
		}),
	},
	{
		code: FINDING_CODES.DISCOUNT_INVALID_AMOUNT,
		severity: "error",
		when: isAmountNotPositive,
		message: (discount) =>
			`Discount "${discount.name}" has amount ${discount.amount} — must be positive.`,
		suggestedFix: "Set a positive discount amount in the dashboard.",
		details: (discount) => ({ name: discount.name, amount: discount.amount }),
	},
	{
		code: FINDING_CODES.DISCOUNT_INVALID_AMOUNT,
		severity: "error",
		when: isPercentOverHundred,
		message: (discount) =>
			`Discount "${discount.name}" is ${discount.amount}% — percent discounts cannot exceed 100%.`,
		suggestedFix: "Set the discount to 100% or less.",
		details: (discount) => ({
			name: discount.name,
			amount: discount.amount,
			amountType: discount.amount_type,
		}),
	},
];

export const validateDiscount = async (
	http: Http,
	mode: Mode,
	{ storeId, discountId }: DiscountCheck,
): Promise<CheckReport<DiscountAttributes>> => {
	const discountLookup = await fetchResource<DiscountAttributes>(http, {
		path: `/v1/discounts/${discountId}`,
		notFound: {
			code: FINDING_CODES.DISCOUNT_NOT_FOUND,
			message: `Discount ${discountId} not found.`,
			suggestedFix: "Verify the discount ID in the Lemon Squeezy dashboard.",
			details: { discountId },
		},
	});

	const isFetchFailed = discountLookup.kind === "failed";
	if (isFetchFailed) {
		return createFailedLookupReport({
			name: "discount",
			mode,
			finding: discountLookup.finding,
			target: { label: `discount ${discountId}`, id: discountId, url: null },
		});
	}

	const discount = discountLookup.resource;
	const now = new Date();
	const storeFindings = listStoreMismatchFindings({
		label: "Discount",
		code: FINDING_CODES.DISCOUNT_STORE_MISMATCH,
		expectedStoreId: storeId,
		actualStoreId: discount.store_id,
		suggestedFix:
			"Use the correct store ID or discount ID — discounts should not cross stores.",
	});
	const discountRules = createDiscountRules(now);
	const ruleFindings = raiseFindings(discountRules, discount);

	return createCheckReport({
		name: "discount",
		mode,
		findings: [...storeFindings, ...ruleFindings],
		resource: discount,
		target: {
			label: `${discount.name} (${discount.code})`,
			id: discountId,
			url: null,
		},
	});
};
