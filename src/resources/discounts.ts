import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedDiscountAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Subset of Lemon Squeezy discount attributes used by the discount validator.
 * Full schema at https://docs.lemonsqueezy.com/api/discounts.
 */
export interface DiscountAttributes extends GeneratedDiscountAttributes {
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
 *
 * @param http - Shared API client.
 * @param discountId - Discount id.
 * @returns The discount resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const discount = await getDiscount(http, 1);
 * ```
 */
export const getDiscount = async (
  http: HttpClient,
  discountId: string | number,
): Promise<JsonApiResource<DiscountAttributes>> => {
  return http.getResource<DiscountAttributes>(`/v1/discounts/${discountId}`);
};

/**
 * List discounts for a store (GET /v1/discounts?filter[store_id]=…).
 *
 * @param http - Shared API client.
 * @param storeId - Store filter.
 * @returns Discount resources.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const discounts = await listDiscountsForStore(http, 1);
 * ```
 */
export const listDiscountsForStore = async (
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<DiscountAttributes>[]> => {
  return http.paginate<DiscountAttributes>("/v1/discounts", {
    "filter[store_id]": String(storeId),
  });
};

/**
 * Create a discount (POST /v1/discounts). No update endpoint exists in the API.
 * Docs: https://docs.lemonsqueezy.com/api/discounts/create-discount
 *
 * @param http - Shared API client.
 * @param body - JSON:API create document.
 * @returns The created discount.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const discount = await createDiscount(http, {
 *   data: {
 *     type: "discounts",
 *     attributes: { name: "Launch", code: "LAUNCH10", amount: 10, amount_type: "percent" },
 *     relationships: { store: { data: { type: "stores", id: "1" } } },
 *   },
 * });
 * ```
 */
export const createDiscount = async (
  http: HttpClient,
  body: unknown,
): Promise<JsonApiResource<DiscountAttributes>> => {
  return http.postResource<DiscountAttributes>("/v1/discounts", body);
};

/**
 * Delete a discount (DELETE /v1/discounts/:id).
 * Docs: https://docs.lemonsqueezy.com/api/discounts/delete-discount
 *
 * @param http - Shared API client.
 * @param discountId - Discount id.
 * @returns Nothing on success.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * await deleteDiscount(http, 1);
 * ```
 */
export const deleteDiscount = async (
  http: HttpClient,
  discountId: string | number,
): Promise<void> => {
  await http.deleteResource(`/v1/discounts/${discountId}`);
};
