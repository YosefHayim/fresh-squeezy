import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

/**
 * Subset of Lemon Squeezy discount attributes used by the discount validator.
 * Full schema at https://docs.lemonsqueezy.com/api/discounts.
 */
export interface DiscountAttributes {
  name: string;
  code: string;
  amount: number;
  amount_type: "percent" | "fixed";
  is_limited_to_products: boolean;
  is_limited_redemptions: boolean;
  max_redemptions: number;
  starts_at: string | null;
  expires_at: string | null;
  status: "draft" | "published";
  duration: "once" | "repeating" | "forever";
  store_id: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch a single discount by ID. The validator uses the discount's
 * `relationships.store` to confirm ownership against the caller's storeId.
 */
export async function getDiscount(
  http: HttpClient,
  discountId: string | number
): Promise<JsonApiResource<DiscountAttributes>> {
  return http.getResource<DiscountAttributes>(`/v1/discounts/${discountId}`);
}
