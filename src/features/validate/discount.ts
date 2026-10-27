import type { Mode } from "@/shared/config.js";
import type { Http } from "@/shared/http.js";
import type { DiscountAttributes } from "@/shared/lemon-squeezy-types.js";
import { fetchResource, storeMismatchFindings } from "./fetch-resource.js";
import {
	buildResult,
	FINDING_CODES,
	type FindingRule,
	findingsFrom,
	type ValidationResult,
} from "./findings.js";

export interface DiscountCheck {
	storeId: string;
	discountId: string;
}

const isDraft = (discount: DiscountAttributes) => discount.status === "draft";

const isExpired = (discount: DiscountAttributes) => {
	const expiresAt = discount.expires_at;
	const isExpirySet = expiresAt !== null;
	return isExpirySet && Date.parse(expiresAt) < Date.now();
};

const isNotStarted = (discount: DiscountAttributes) => {
	const startsAt = discount.starts_at;
	const isStartSet = startsAt !== null;
	return isStartSet && Date.parse(startsAt) > Date.now();
};

const isOutOfRedemptions = (discount: DiscountAttributes) =>
	discount.is_limited_redemptions && discount.max_redemptions <= 0;

const isAmountNotPositive = (discount: DiscountAttributes) =>
	discount.amount <= 0;

const isPercentOverHundred = (discount: DiscountAttributes) =>
	discount.amount_type === "percent" && discount.amount > 100;

const DISCOUNT_RULES: FindingRule<DiscountAttributes>[] = [
	{
		code: FINDING_CODES.DISCOUNT_DRAFT,
		severity: "warning",
		when: isDraft,
		message: (discount) =>
			`Discount "${discount.name}" is in draft status — customers cannot redeem it.`,
		suggestedFix:
			"Publish the discount in the Lemon Squeezy dashboard before sharing the code.",
		context: (discount) => ({ name: discount.name, code: discount.code }),
	},
	{
		code: FINDING_CODES.DISCOUNT_EXPIRED,
		severity: "error",
		when: isExpired,
		message: (discount) =>
			`Discount "${discount.name}" expired at ${discount.expires_at}.`,
		suggestedFix: "Extend the expiration date or create a new discount.",
		context: (discount) => ({
			name: discount.name,
			expiresAt: discount.expires_at,
		}),
	},
	{
		code: FINDING_CODES.DISCOUNT_NOT_STARTED,
		severity: "warning",
		when: isNotStarted,
		message: (discount) =>
			`Discount "${discount.name}" starts at ${discount.starts_at} — not yet active.`,
		suggestedFix: "Wait for the start date or adjust it in the dashboard.",
		context: (discount) => ({
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
		context: (discount) => ({
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
		context: (discount) => ({ name: discount.name, amount: discount.amount }),
	},
	{
		code: FINDING_CODES.DISCOUNT_INVALID_AMOUNT,
		severity: "error",
		when: isPercentOverHundred,
		message: (discount) =>
			`Discount "${discount.name}" is ${discount.amount}% — percent discounts cannot exceed 100%.`,
		suggestedFix: "Set the discount to 100% or less.",
		context: (discount) => ({
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
): Promise<ValidationResult<DiscountAttributes>> => {
	const fetched = await fetchResource<DiscountAttributes>(http, {
		path: `/v1/discounts/${discountId}`,
		notFound: {
			code: FINDING_CODES.DISCOUNT_NOT_FOUND,
			message: `Discount ${discountId} not found.`,
			suggestedFix: "Verify the discount ID in the Lemon Squeezy dashboard.",
			context: { discountId },
		},
	});

	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) {
		return buildResult({
			name: "discount",
			mode,
			findings: [fetched.finding],
			target: { label: `discount ${discountId}`, id: discountId },
		});
	}

	const discount = fetched.payload;
	const storeFindings = storeMismatchFindings({
		label: "Discount",
		code: FINDING_CODES.DISCOUNT_STORE_MISMATCH,
		expectedStoreId: storeId,
		actualStoreId: discount.store_id,
		suggestedFix:
			"Use the correct store ID or discount ID — discounts should not cross stores.",
	});
	const ruleFindings = findingsFrom(DISCOUNT_RULES, discount);
	return buildResult({
		name: "discount",
		mode,
		findings: [...storeFindings, ...ruleFindings],
		resource: discount,
		target: { label: `${discount.name} (${discount.code})`, id: discountId },
	});
};
