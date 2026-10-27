import type { DiscountAttributes } from "@/shared/attributes.js";
import type {
	Mode,
	ResourceId,
	ValidationIssue,
	ValidationResult,
} from "@/shared/contracts.js";
import type { HttpClient } from "@/shared/http.js";
import { isFuture, isPast } from "./dates.js";
import {
	buildResult,
	failedResult,
	ISSUE_CODES,
	type IssueRule,
	issuesOf,
} from "./issues.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";

export interface DiscountValidationOptions {
	storeId: ResourceId;
	discountId: ResourceId;
}

export const validateDiscount = async (
	http: HttpClient,
	mode: Mode,
	options: DiscountValidationOptions,
): Promise<ValidationResult<DiscountAttributes>> => {
	const target = {
		label: `discount ${options.discountId}`,
		id: String(options.discountId),
	};

	const fetched = await probeFetch(
		() =>
			http.getResource<DiscountAttributes>(
				`/v1/discounts/${options.discountId}`,
			),
		{
			code: ISSUE_CODES.DISCOUNT_NOT_FOUND,
			message: `Discount ${options.discountId} not found.`,
			suggestedFix: "Verify the discount ID in the Lemon Squeezy dashboard.",
			context: { discountId: String(options.discountId) },
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return failedResult("discount", mode, fetched.issue, target);
	}

	const attributes = fetched.resource.attributes;
	const issues = checkDiscount(attributes, { storeId: options.storeId });
	return buildResult("discount", mode, issues, attributes, {
		label: `${attributes.name} (${attributes.code})`,
		id: String(options.discountId),
	});
};

const discountIssueRules: IssueRule<DiscountAttributes>[] = [
	{
		code: ISSUE_CODES.DISCOUNT_DRAFT,
		severity: "warning",
		isRaised: (attributes) => attributes.status === "draft",
		message: (attributes) =>
			`Discount "${attributes.name}" is in draft status — customers cannot redeem it.`,
		suggestedFix:
			"Publish the discount in the Lemon Squeezy dashboard before sharing the code.",
		context: (attributes) => ({
			name: attributes.name,
			code: attributes.code,
		}),
	},
	{
		code: ISSUE_CODES.DISCOUNT_EXPIRED,
		severity: "error",
		isRaised: (attributes) => isPast(attributes.expires_at),
		message: (attributes) =>
			`Discount "${attributes.name}" expired at ${attributes.expires_at}.`,
		suggestedFix: "Extend the expiration date or create a new discount.",
		context: (attributes) => ({
			name: attributes.name,
			expiresAt: attributes.expires_at,
		}),
	},
	{
		code: ISSUE_CODES.DISCOUNT_NOT_STARTED,
		severity: "warning",
		isRaised: (attributes) => isFuture(attributes.starts_at),
		message: (attributes) =>
			`Discount "${attributes.name}" starts at ${attributes.starts_at} — not yet active.`,
		suggestedFix: "Wait for the start date or adjust it in the dashboard.",
		context: (attributes) => ({
			name: attributes.name,
			startsAt: attributes.starts_at,
		}),
	},
	{
		code: ISSUE_CODES.DISCOUNT_REDEMPTIONS_EXHAUSTED,
		severity: "warning",
		isRaised: (attributes) =>
			attributes.is_limited_redemptions && attributes.max_redemptions <= 0,
		message: (attributes) =>
			`Discount "${attributes.name}" has limited redemptions with max_redemptions ≤ 0.`,
		suggestedFix: "Increase max_redemptions or disable the redemption limit.",
		context: (attributes) => ({
			name: attributes.name,
			maxRedemptions: attributes.max_redemptions,
		}),
	},
	{
		code: ISSUE_CODES.DISCOUNT_INVALID_AMOUNT,
		severity: "error",
		isRaised: (attributes) => attributes.amount <= 0,
		message: (attributes) =>
			`Discount "${attributes.name}" has amount ${attributes.amount} — must be positive.`,
		suggestedFix: "Set a positive discount amount in the dashboard.",
		context: (attributes) => ({
			name: attributes.name,
			amount: attributes.amount,
		}),
	},
	{
		code: ISSUE_CODES.DISCOUNT_INVALID_AMOUNT,
		severity: "error",
		isRaised: (attributes) =>
			attributes.amount_type === "percent" && attributes.amount > 100,
		message: (attributes) =>
			`Discount "${attributes.name}" is ${attributes.amount}% — percent discounts cannot exceed 100%.`,
		suggestedFix: "Set the discount to 100% or less.",
		context: (attributes) => ({
			name: attributes.name,
			amount: attributes.amount,
			amountType: attributes.amount_type,
		}),
	},
];

export const checkDiscount = (
	attributes: DiscountAttributes,
	options: { storeId: ResourceId },
): ValidationIssue[] => {
	const ownershipIssues = checkStoreOwnership({
		expectedStoreId: options.storeId,
		actualStoreId: attributes.store_id,
		code: ISSUE_CODES.DISCOUNT_STORE_MISMATCH,
		label: "Discount",
		suggestedFix:
			"Use the correct store ID or discount ID — discounts should not cross stores.",
	});
	return [...ownershipIssues, ...issuesOf(discountIssueRules, attributes)];
};
