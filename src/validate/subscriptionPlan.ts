import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { getProduct } from "../resources/products.js";
import { getVariant, type SubscriptionVariantAttributes } from "../resources/variants.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

export interface SubscriptionPlanValidationOptions {
  storeId: string | number;
  variantId: string | number;
}

/** Summary of a subscription plan variant's validated state. */
export interface SubscriptionPlanSummary {
  variantId: string;
  interval: string | null;
  intervalCount: number | null;
  price: number;
  hasFreeTrial: boolean;
  status: string;
}

const VALID_INTERVALS = new Set(["day", "week", "month", "year"]);

/**
 * Validate a Lemon Squeezy "subscription plan", which is a variant with
 * `is_subscription: true`. Checks that the variant is actually a subscription,
 * has a valid billing interval, and that trial settings are consistent.
 *
 * Store cross-check requires fetching the parent product to read its
 * `store_id`. This is an extra network hop but catches the common mistake of
 * passing a variant ID from one store while targeting another. Accept the
 * `storeId` as advisory — if the product fetch fails the cross-check is
 * silently skipped rather than blocking the entire validation.
 */
export async function validateSubscriptionPlan(
  http: HttpClient,
  mode: Mode,
  options: SubscriptionPlanValidationOptions
): Promise<ValidationResult<SubscriptionPlanSummary>> {
  const issues: ValidationIssue[] = [];

  const fetched = await probeFetch(
    () => getVariant<SubscriptionVariantAttributes>(http, options.variantId),
    {
      notFoundCode: ISSUE_CODES.PLAN_VARIANT_NOT_FOUND,
      notFoundMessage: `Variant ${options.variantId} not found.`,
      notFoundFix: "Verify the variant ID in the Lemon Squeezy dashboard.",
      notFoundContext: { variantId: String(options.variantId) },
    }
  );

  if (!fetched.ok) {
    issues.push(fetched.issue);
    return buildResult<SubscriptionPlanSummary>("subscriptionPlan", mode, issues, undefined, {
      label: `variant ${options.variantId}`,
      id: String(options.variantId),
    });
  }

  const variant = fetched.resource;
  const attrs = variant.attributes;

  if (!attrs.is_subscription) {
    issues.push(
      issue(
        ISSUE_CODES.PLAN_NOT_SUBSCRIPTION,
        "error",
        `Variant ${options.variantId} is not a subscription variant (is_subscription is false).`,
        {
          suggestedFix: "Use a variant that has subscription billing enabled, or use the regular variant validator.",
          context: { variantId: String(options.variantId) },
        }
      )
    );
  }

  if (!attrs.interval || !VALID_INTERVALS.has(attrs.interval)) {
    issues.push(
      issue(
        ISSUE_CODES.PLAN_INVALID_INTERVAL,
        "error",
        `Subscription variant has invalid interval: "${attrs.interval ?? "missing"}". Expected one of: day, week, month, year.`,
        {
          suggestedFix: "Set a valid billing interval in the variant configuration.",
          context: { interval: attrs.interval ?? null },
        }
      )
    );
  }

  if (attrs.interval_count === null || attrs.interval_count <= 0) {
    issues.push(
      issue(
        ISSUE_CODES.PLAN_INVALID_INTERVAL,
        "error",
        `Subscription variant has invalid interval_count: ${attrs.interval_count}. Must be a positive integer.`,
        {
          suggestedFix: "Set interval_count to a positive value (e.g. 1 for monthly, 2 for biweekly).",
          context: { intervalCount: attrs.interval_count },
        }
      )
    );
  }

  if (attrs.price === 0 && attrs.is_subscription) {
    issues.push(
      issue(
        ISSUE_CODES.PLAN_FREE_PRICE,
        "warning",
        `Subscription variant has a price of 0 — this is almost always a misconfiguration for paid plans.`,
        {
          suggestedFix: "Set the variant price to the intended amount in cents, or confirm this is intentionally free.",
          context: { price: attrs.price },
        }
      )
    );
  }

  if (attrs.has_free_trial && (!attrs.trial_interval || (attrs.trial_interval_count ?? 0) <= 0)) {
    issues.push(
      issue(
        ISSUE_CODES.PLAN_TRIAL_INCONSISTENT,
        "warning",
        `Subscription variant has free trial enabled but trial interval is misconfigured (interval: "${attrs.trial_interval ?? "missing"}", count: ${attrs.trial_interval_count ?? 0}).`,
        {
          suggestedFix: "Set a valid trial interval and count, or disable the free trial.",
          context: {
            trialInterval: attrs.trial_interval ?? null,
            trialIntervalCount: attrs.trial_interval_count ?? null,
          },
        }
      )
    );
  }

  if (attrs.status === "draft") {
    issues.push(
      issue(
        ISSUE_CODES.PLAN_DRAFT,
        "warning",
        `Subscription variant is in draft status — customers cannot subscribe.`,
        {
          suggestedFix: "Publish the variant in the Lemon Squeezy dashboard.",
          context: { status: attrs.status },
        }
      )
    );
  }

  // Store cross-check: fetch the parent product to compare store ownership.
  // If the fetch fails, skip the check rather than blocking the whole validation.
  try {
    const product = await getProduct(http, attrs.product_id);
    const mismatch = checkStoreOwnership({
      expectedStoreId: options.storeId,
      actualStoreId: product.attributes.store_id,
      code: ISSUE_CODES.PLAN_STORE_MISMATCH,
      label: `Subscription variant (via product ${attrs.product_id})`,
      suggestedFix: "Use the correct store ID or variant ID — plans should not cross stores.",
      extraContext: { productId: String(attrs.product_id) },
    });
    if (mismatch) issues.push(mismatch);
  } catch {
    // Intentionally silent — the product fetch is advisory for the store
    // cross-check and should not block the rest of the validation.
  }

  const summary: SubscriptionPlanSummary = {
    variantId: variant.id,
    interval: attrs.interval,
    intervalCount: attrs.interval_count,
    price: attrs.price,
    hasFreeTrial: attrs.has_free_trial,
    status: attrs.status,
  };

  return buildResult("subscriptionPlan", mode, issues, summary, {
    label: attrs.name,
    id: String(options.variantId),
  });
}
