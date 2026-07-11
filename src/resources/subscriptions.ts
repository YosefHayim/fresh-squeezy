import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedSubscriptionAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * URLs Lemon Squeezy attaches to a subscription so consumers can deep-link
 * users to billing pages. The set has grown over time; we keep optional
 * fields for forward-compatibility.
 */
export interface SubscriptionUrls {
  update_payment_method?: string;
  customer_portal?: string;
  /** Added 2024-02-20: lets consumers offer "manage subscription" without an extra round-trip. */
  update_customer_portal?: string | null;
  /** Current API examples also surface this key name for PayPal update flows. */
  customer_portal_update_subscription?: string | null;
}

export interface SubscriptionPause {
  mode: "void" | "free" | string;
  resumes_at?: string | null;
}

export interface SubscriptionItemSummary {
  id: number;
  subscription_id: number;
  price_id: number;
  quantity: number;
  created_at?: string;
  updated_at?: string;
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
 *   - `tax_inclusive` — invoice-only in current API docs; retained here as
 *     a compatibility field for consumers that previously normalised
 *     subscription and subscription invoice payloads together.
 */
export interface SubscriptionAttributes extends GeneratedSubscriptionAttributes {
  store_id: number;
  customer_id: number;
  order_id?: number;
  order_item_id?: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  user_name: string;
  user_email: string;
  status: "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";
  status_formatted: string;
  card_brand?: string | null;
  card_last_four?: string | null;
  /** Added 2025-06-11. Identifies which payment provider processed the transaction. */
  payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string;
  pause?: SubscriptionPause | null;
  cancelled?: boolean;
  trial_ends_at?: string | null;
  billing_anchor?: number;
  first_subscription_item?: SubscriptionItemSummary | null;
  urls?: SubscriptionUrls;
  renews_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
  /** Compatibility field for older fresh-squeezy consumers; prefer SubscriptionInvoiceAttributes.tax_inclusive. */
  tax_inclusive?: boolean;
}

/**
 * Fetch a single subscription by ID.
 *
 * @param http - Shared API client.
 * @param subscriptionId - Subscription id.
 * @returns The subscription resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const sub = await getSubscription(http, 1);
 * ```
 */
export const getSubscription = async (
  http: HttpClient,
  subscriptionId: string | number,
): Promise<JsonApiResource<SubscriptionAttributes>> => {
  return http.getResource<SubscriptionAttributes>(`/v1/subscriptions/${subscriptionId}`);
};

/**
 * List subscriptions for a store.
 *
 * @param http - Shared API client.
 * @param storeId - Store filter.
 * @returns Subscription resources.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const subs = await listSubscriptionsForStore(http, 1);
 * ```
 */
export const listSubscriptionsForStore = async (
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<SubscriptionAttributes>[]> => {
  return http.paginate<SubscriptionAttributes>("/v1/subscriptions", {
    "filter[store_id]": String(storeId),
  });
};

/**
 * Update a subscription (PATCH /v1/subscriptions/:id) — plan change, pause, etc.
 * Docs: https://docs.lemonsqueezy.com/api/subscriptions/update-subscription
 *
 * @param http - Shared API client.
 * @param subscriptionId - Subscription id.
 * @param body - JSON:API update document.
 * @returns The updated subscription.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const sub = await updateSubscription(http, 1, {
 *   data: { type: "subscriptions", id: "1", attributes: { variant_id: 2 } },
 * });
 * ```
 */
export const updateSubscription = async (
  http: HttpClient,
  subscriptionId: string | number,
  body: unknown,
): Promise<JsonApiResource<SubscriptionAttributes>> => {
  return http.patchResource<SubscriptionAttributes>(`/v1/subscriptions/${subscriptionId}`, body);
};

/**
 * Cancel a subscription (DELETE /v1/subscriptions/:id).
 * Docs: https://docs.lemonsqueezy.com/api/subscriptions/cancel-subscription
 *
 * @param http - Shared API client.
 * @param subscriptionId - Subscription id.
 * @returns The cancelled subscription resource when the API returns one.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const sub = await cancelSubscription(http, 1);
 * ```
 */
export const cancelSubscription = async (
  http: HttpClient,
  subscriptionId: string | number,
): Promise<JsonApiResource<SubscriptionAttributes> | undefined> => {
  const doc = await http.request<{ data?: JsonApiResource<SubscriptionAttributes> }>({
    method: "DELETE",
    path: `/v1/subscriptions/${subscriptionId}`,
  });
  return doc?.data;
};
