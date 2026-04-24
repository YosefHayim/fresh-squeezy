import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

/**
 * Subset of product attributes we need for validation. `status` drives the
 * "unpublished product" check; `store_id` drives ownership checks.
 */
export interface ProductAttributes {
  name: string;
  slug: string;
  description?: string | null;
  status: "draft" | "published";
  status_formatted?: string;
  store_id: number;
  buy_now_url?: string | null;
  from_price?: number | null;
  to_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

export async function getProduct(
  http: HttpClient,
  productId: string | number
): Promise<JsonApiResource<ProductAttributes>> {
  return http.getResource<ProductAttributes>(`/v1/products/${productId}`);
}

export async function listProducts(
  http: HttpClient,
  storeId: string | number
): Promise<JsonApiResource<ProductAttributes>[]> {
  return http.getCollection<ProductAttributes>("/v1/products", {
    "filter[store_id]": String(storeId),
  });
}
