import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedOrderAttributes } from "../generated/lemonSqueezyApiTypes.js";

export interface OrderUrls {
  receipt?: string;
}

export interface OrderFirstItem {
  id: number;
  order_id?: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  price: number;
  quantity?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Subset of Lemon Squeezy order attributes fresh-squeezy understands.
 *
 * fresh-squeezy does not (yet) validate orders — the type is exported so
 * consumers using the raw `client.request<OrderAttributes>()` escape hatch
 * get a typed response that includes platform additions the official SDK
 * has not yet picked up.
 *
 * Field provenance against the changelog
 * (https://docs.lemonsqueezy.com/api/getting-started/changelog):
 *
 *   - `status: "fraudulent"` — added 2024-09-10. Indicates a manual fraud
 *     flag; treat as terminal and refund or chargeback as appropriate.
 *   - `refunded_amount`, `refunded_amount_usd`, `refunded_amount_formatted`
 *     — added 2024-08-07. Useful for consumers reconciling partial refunds.
 *   - `tax_inclusive` — added 2024-02-05.
 */
export interface OrderAttributes extends GeneratedOrderAttributes {
  store_id: number;
  customer_id?: number;
  identifier: string;
  order_number: number;
  user_name: string;
  user_email: string;
  currency: string;
  currency_rate: string;
  subtotal: number;
  setup_fee?: number;
  discount_total: number;
  tax: number;
  tax_inclusive?: boolean;
  total: number;
  refunded_amount?: number;
  subtotal_usd?: number;
  setup_fee_usd?: number;
  discount_total_usd?: number;
  tax_usd?: number;
  total_usd?: number;
  refunded_amount_usd?: number | null;
  tax_name?: string | null;
  tax_rate?: number | string | null;
  refunded_amount_formatted?: string | null;
  refunded?: boolean;
  refunded_at?: string | null;
  status: "pending" | "failed" | "paid" | "refunded" | "fraudulent" | "partial_refund";
  status_formatted: string;
  subtotal_formatted?: string;
  setup_fee_formatted?: string;
  discount_total_formatted?: string;
  tax_formatted?: string;
  total_formatted?: string;
  first_order_item?: OrderFirstItem | null;
  urls?: OrderUrls;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

/**
 * Fetch a single order by ID.
 *
 * @param http - Shared API client.
 * @param orderId - Order id.
 * @returns The order resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const order = await getOrder(http, 1);
 * ```
 */
export const getOrder = async (
  http: HttpClient,
  orderId: string | number,
): Promise<JsonApiResource<OrderAttributes>> => {
  return http.getResource<OrderAttributes>(`/v1/orders/${orderId}`);
};

/**
 * List orders for a store.
 *
 * @param http - Shared API client.
 * @param storeId - Store filter.
 * @returns Order resources.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const orders = await listOrdersForStore(http, 1);
 * ```
 */
export const listOrdersForStore = async (
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<OrderAttributes>[]> => {
  return http.paginate<OrderAttributes>("/v1/orders", {
    "filter[store_id]": String(storeId),
  });
};

/**
 * Issue a full or partial order refund (POST /v1/orders/:id/refund).
 * Docs: https://docs.lemonsqueezy.com/api/orders/issue-refund
 *
 * @param http - Shared API client.
 * @param orderId - Order to refund.
 * @param body - Optional JSON:API body (`attributes.amount` for partial).
 * @returns The updated order after refund.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const order = await refundOrder(http, 1);
 * ```
 */
export const refundOrder = async (
  http: HttpClient,
  orderId: string | number,
  body?: unknown,
): Promise<JsonApiResource<OrderAttributes>> => {
  return http.postResource<OrderAttributes>(`/v1/orders/${orderId}/refund`, body ?? {});
};

/**
 * Generate an order invoice (POST /v1/orders/:id/generate-invoice).
 * Docs: https://docs.lemonsqueezy.com/api/orders/generate-order-invoice
 *
 * @param http - Shared API client.
 * @param orderId - Order id.
 * @param body - Optional locale/name attributes document.
 * @returns API response document (invoice URL payload).
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const invoice = await generateOrderInvoice(http, 1);
 * ```
 */
export const generateOrderInvoice = async (
  http: HttpClient,
  orderId: string | number,
  body?: unknown,
): Promise<unknown> => {
  return http.request({
    method: "POST",
    path: `/v1/orders/${orderId}/generate-invoice`,
    body: body ?? {},
  });
};
