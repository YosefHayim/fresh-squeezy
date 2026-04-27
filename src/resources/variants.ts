import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

/**
 * Variant attributes used by the product validator to detect
 * variant/price drift from the product they belong to.
 */
export interface VariantAttributes {
  product_id: number;
  name: string;
  slug: string;
  description?: string | null;
  status: "pending" | "draft" | "published";
  is_subscription?: boolean;
  interval?: string | null;
  interval_count?: number | null;
  has_license_keys?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Extended variant attributes for subscription plan validation. In Lemon
 * Squeezy, "subscription plans" live as variants with `is_subscription: true`.
 * These fields are only present on subscription variants and are checked by
 * the subscription plan validator to catch misconfigured trial periods,
 * zero-price plans, and invalid billing intervals.
 */
export interface SubscriptionVariantAttributes extends VariantAttributes {
  is_subscription: boolean;
  interval: string | null;
  interval_count: number | null;
  has_free_trial: boolean;
  trial_interval: string | null;
  trial_interval_count: number | null;
  price: number;
}

/**
 * Fetch a single variant by ID. Used by the subscription plan validator to
 * inspect subscription-specific fields (interval, trial, price).
 */
export async function getVariant<TAttr = VariantAttributes>(
  http: HttpClient,
  variantId: string | number
): Promise<JsonApiResource<TAttr>> {
  return http.getResource<TAttr>(`/v1/variants/${variantId}`);
}

export async function listVariantsForProduct(
  http: HttpClient,
  productId: string | number
): Promise<JsonApiResource<VariantAttributes>[]> {
  return http.getCollection<VariantAttributes>("/v1/variants", {
    "filter[product_id]": String(productId),
  });
}
