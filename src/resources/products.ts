import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedProductAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Subset of product attributes we need for validation. `status` drives the
 * "unpublished product" check; `store_id` drives ownership checks.
 */
export interface ProductAttributes extends GeneratedProductAttributes {
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

export const getProduct = async (
  http: HttpClient,
  productId: string | number,
): Promise<JsonApiResource<ProductAttributes>> => {
  return http.getResource<ProductAttributes>(`/v1/products/${productId}`);
};

/**
 * List every product in the store, paginated. Used by the CLI's
 * interactive product picker; without pagination only the first 25
 * products are offered.
 */
export const listProducts = async (
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<ProductAttributes>[]> => {
  return http.paginate<ProductAttributes>("/v1/products", {
    "filter[store_id]": String(storeId),
  });
};
