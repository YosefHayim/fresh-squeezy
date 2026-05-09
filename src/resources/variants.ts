import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedVariantAttributes } from "../generated/lemonSqueezyApiTypes.js";

export interface VariantLink {
  title: string;
  url: string;
}

/**
 * Variant attributes used by the product validator to detect
 * variant/price drift from the product they belong to.
 */
export interface VariantAttributes extends GeneratedVariantAttributes {
  product_id: number;
  name: string;
  slug: string;
  description?: string | null;
  has_license_keys?: boolean;
  license_activation_limit?: number | null;
  is_license_limit_unlimited?: boolean;
  license_length_value?: number | null;
  license_length_unit?: "day" | "week" | "month" | "year" | null;
  is_license_length_unlimited?: boolean;
  status: "pending" | "draft" | "published";
  status_formatted?: string;
  is_subscription?: boolean;
  interval?: string | null;
  interval_count?: number | null;
  sort?: number;
  /**
   * Hosted-checkout-style links keyed by purpose. Added 2024-06-09 — older
   * SDK and validator versions don't surface this field, so consumers had
   * to read `meta.product_links` manually before. Optional because the
   * field is absent on older variants.
   */
  links?: VariantLink[] | Record<string, string>;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
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

/**
 * List every variant of the product, paginated so products with more than
 * one page of variants don't trip the `VARIANT_UNPUBLISHED` heuristic when
 * the only published variants happen to live past page 1.
 */
export async function listVariantsForProduct(
  http: HttpClient,
  productId: string | number
): Promise<JsonApiResource<VariantAttributes>[]> {
  return http.paginate<VariantAttributes>("/v1/variants", {
    "filter[product_id]": String(productId),
  });
}
