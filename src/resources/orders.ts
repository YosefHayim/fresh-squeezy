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
 * Fetch a single order by ID. Provided for consumers that want typed
 * access to orders without hand-rolling the JSON:API envelope; the
 * library intentionally has no order *validator* yet.
 */
export async function getOrder(
  http: HttpClient,
  orderId: string | number,
): Promise<JsonApiResource<OrderAttributes>> {
  return http.getResource<OrderAttributes>(`/v1/orders/${orderId}`);
}
