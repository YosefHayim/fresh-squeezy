import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

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
export interface OrderAttributes {
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
  refunded_amount_usd?: number | null;
  refunded_amount_formatted?: string | null;
  refunded?: boolean;
  refunded_at?: string | null;
  status:
    | "pending"
    | "failed"
    | "paid"
    | "refunded"
    | "fraudulent"
    | "partial_refund";
  status_formatted: string;
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
  orderId: string | number
): Promise<JsonApiResource<OrderAttributes>> {
  return http.getResource<OrderAttributes>(`/v1/orders/${orderId}`);
}
