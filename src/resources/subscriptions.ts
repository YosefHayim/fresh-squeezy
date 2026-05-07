import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

/**
 * URLs Lemon Squeezy attaches to a subscription so consumers can deep-link
 * users to billing pages. The set has grown over time; we keep optional
 * fields for forward-compatibility.
 */
export interface SubscriptionUrls {
  update_payment_method?: string;
  customer_portal?: string;
  /** Added 2024-02-20: lets consumers offer "manage subscription" without an extra round-trip. */
  update_customer_portal?: string;
}

/**
 * Subset of subscription attributes. fresh-squeezy does not (yet) validate
 * subscriptions — this type is exported so consumers using the raw
 * `client.request<SubscriptionAttributes>()` escape hatch get a typed
 * response that includes platform additions the official SDK has not yet
 * picked up.
 *
 * Field provenance against the changelog:
 *   - `payment_processor` — added 2025-06-11.
 *   - `urls.update_customer_portal` — added 2024-02-20.
 *   - `tax_inclusive` — added 2024-02-05 (on subscription invoices, not
 *     on the subscription itself; included here because consumers
 *     normalise the two).
 */
export interface SubscriptionAttributes {
  store_id: number;
  customer_id: number;
  order_id?: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  user_name: string;
  user_email: string;
  status:
    | "on_trial"
    | "active"
    | "paused"
    | "past_due"
    | "unpaid"
    | "cancelled"
    | "expired";
  status_formatted: string;
  card_brand?: string | null;
  card_last_four?: string | null;
  /** Added 2025-06-11. Identifies which payment provider processed the transaction. */
  payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string;
  trial_ends_at?: string | null;
  billing_anchor?: number;
  urls?: SubscriptionUrls;
  renews_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
  /** Added 2024-02-05 (subscription invoice surface). Optional because not every read includes it. */
  tax_inclusive?: boolean;
}

/**
 * Fetch a single subscription by ID. Provided for consumers that want
 * typed access without hand-rolling the JSON:API envelope; the library
 * has no subscription *validator* yet.
 */
export async function getSubscription(
  http: HttpClient,
  subscriptionId: string | number
): Promise<JsonApiResource<SubscriptionAttributes>> {
  return http.getResource<SubscriptionAttributes>(`/v1/subscriptions/${subscriptionId}`);
}
