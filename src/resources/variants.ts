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

export async function listVariantsForProduct(
  http: HttpClient,
  productId: string | number
): Promise<JsonApiResource<VariantAttributes>[]> {
  return http.getCollection<VariantAttributes>("/v1/variants", {
    "filter[product_id]": String(productId),
  });
}
