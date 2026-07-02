import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { type DiscountAttributes, getDiscount } from "../resources/discounts.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

export interface DiscountValidationOptions {
  storeId: string | number;
  discountId: string | number;
}

/**
 * Validate a Lemon Squeezy discount code. Catches the most common
 * misconfigurations: draft discounts that can't be redeemed, expired or
 * not-yet-active windows, invalid amounts (negative or >100% for percent
 * type), and store ownership mismatches.
 *
 * The redemption exhaustion check is deliberately conservative (v1): it only
 * flags when `is_limited_redemptions` is true and `max_redemptions` is zero,
 * because a full redemption count fetch against
 * `/v1/discount-redemptions?filter[discount_id]=` is YAGNI until a consumer
 * asks for it.
 */
export async function validateDiscount(
  http: HttpClient,
  mode: Mode,
  options: DiscountValidationOptions,
): Promise<ValidationResult<DiscountAttributes>> {
  const issues: ValidationIssue[] = [];

  const fetched = await probeFetch(() => getDiscount(http, options.discountId), {
    notFoundCode: ISSUE_CODES.DISCOUNT_NOT_FOUND,
    notFoundMessage: `Discount ${options.discountId} not found.`,
    notFoundFix: "Verify the discount ID in the Lemon Squeezy dashboard.",
    notFoundContext: { discountId: String(options.discountId) },
  });

  if (!fetched.ok) {
    issues.push(fetched.issue);
    return buildResult<DiscountAttributes>("discount", mode, issues, undefined, {
      label: `discount ${options.discountId}`,
      id: String(options.discountId),
    });
  }

  const attrs = fetched.resource.attributes;
  issues.push(...checkDiscount(attrs, { storeId: options.storeId }));

  return buildResult("discount", mode, issues, attrs, {
    label: `${attrs.name} (${attrs.code})`,
    id: String(options.discountId),
  });
}

/**
 * Pure attribute assertions for a discount: store ownership, draft/expiry/
 * activation windows, redemption exhaustion, and amount validity. No I/O, so
 * the rules are unit-testable with plain data.
 */
export function checkDiscount(
  attrs: DiscountAttributes,
  options: { storeId: string | number },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const mismatch = checkStoreOwnership({
    expectedStoreId: options.storeId,
    actualStoreId: attrs.store_id,
    code: ISSUE_CODES.DISCOUNT_STORE_MISMATCH,
    label: "Discount",
    suggestedFix: "Use the correct store ID or discount ID — discounts should not cross stores.",
  });
  if (mismatch) issues.push(mismatch);

  if (attrs.status === "draft") {
    issues.push(
      issue(
        ISSUE_CODES.DISCOUNT_DRAFT,
        "warning",
        `Discount "${attrs.name}" is in draft status — customers cannot redeem it.`,
        {
          suggestedFix:
            "Publish the discount in the Lemon Squeezy dashboard before sharing the code.",
          context: { name: attrs.name, code: attrs.code },
        },
      ),
    );
  }

  const now = new Date();
  if (attrs.expires_at && new Date(attrs.expires_at) < now) {
    issues.push(
      issue(
        ISSUE_CODES.DISCOUNT_EXPIRED,
        "error",
        `Discount "${attrs.name}" expired at ${attrs.expires_at}.`,
        {
          suggestedFix: "Extend the expiration date or create a new discount.",
          context: { name: attrs.name, expiresAt: attrs.expires_at },
        },
      ),
    );
  }

  if (attrs.starts_at && new Date(attrs.starts_at) > now) {
    issues.push(
      issue(
        ISSUE_CODES.DISCOUNT_NOT_STARTED,
        "warning",
        `Discount "${attrs.name}" starts at ${attrs.starts_at} — not yet active.`,
        {
          suggestedFix: "Wait for the start date or adjust it in the dashboard.",
          context: { name: attrs.name, startsAt: attrs.starts_at },
        },
      ),
    );
  }

  if (attrs.is_limited_redemptions && attrs.max_redemptions <= 0) {
    issues.push(
      issue(
        ISSUE_CODES.DISCOUNT_REDEMPTIONS_EXHAUSTED,
        "warning",
        `Discount "${attrs.name}" has limited redemptions with max_redemptions ≤ 0.`,
        {
          suggestedFix: "Increase max_redemptions or disable the redemption limit.",
          context: { name: attrs.name, maxRedemptions: attrs.max_redemptions },
        },
      ),
    );
  }

  if (attrs.amount <= 0) {
    issues.push(
      issue(
        ISSUE_CODES.DISCOUNT_INVALID_AMOUNT,
        "error",
        `Discount "${attrs.name}" has amount ${attrs.amount} — must be positive.`,
        {
          suggestedFix: "Set a positive discount amount in the dashboard.",
          context: { name: attrs.name, amount: attrs.amount },
        },
      ),
    );
  } else if (attrs.amount_type === "percent" && attrs.amount > 100) {
    issues.push(
      issue(
        ISSUE_CODES.DISCOUNT_INVALID_AMOUNT,
        "error",
        `Discount "${attrs.name}" is ${attrs.amount}% — percent discounts cannot exceed 100%.`,
        {
          suggestedFix: "Set the discount to 100% or less.",
          context: { name: attrs.name, amount: attrs.amount, amountType: attrs.amount_type },
        },
      ),
    );
  }

  return issues;
}
