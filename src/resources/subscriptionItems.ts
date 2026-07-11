import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedSubscriptionItemAttributes } from "../generated/lemonSqueezyApiTypes.js";

export interface SubscriptionItemAttributes extends GeneratedSubscriptionItemAttributes {
  subscription_id: number;
  price_id: number;
  quantity: number;
  is_usage_based: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Attributes accepted by the update subscription item endpoint. The proration
 * controls were added in the 2024-02-12 changelog.
 */
export interface SubscriptionItemUpdateAttributes {
  quantity?: number;
  invoice_immediately?: boolean;
  disable_prorations?: boolean;
}

/**
 * Retrieve a subscription item.
 *
 * @param http - Shared API client.
 * @param subscriptionItemId - Item id.
 * @returns The subscription item resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const item = await getSubscriptionItem(http, 1);
 * ```
 */
export const getSubscriptionItem = async (
  http: HttpClient,
  subscriptionItemId: string | number,
): Promise<JsonApiResource<SubscriptionItemAttributes>> => {
  return http.getResource<SubscriptionItemAttributes>(
    `/v1/subscription-items/${subscriptionItemId}`,
  );
};

/**
 * List subscription items for a subscription.
 *
 * @param http - Shared API client.
 * @param subscriptionId - Parent subscription id.
 * @returns Subscription item resources.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const items = await listSubscriptionItemsForSubscription(http, 1);
 * ```
 */
export const listSubscriptionItemsForSubscription = async (
  http: HttpClient,
  subscriptionId: string | number,
): Promise<JsonApiResource<SubscriptionItemAttributes>[]> => {
  return http.paginate<SubscriptionItemAttributes>("/v1/subscription-items", {
    "filter[subscription_id]": String(subscriptionId),
  });
};

/**
 * Build a JSON:API update body for a subscription item (quantity / proration).
 *
 * @param subscriptionItemId - Item id embedded in the document.
 * @param attributes - Fields accepted by the update endpoint.
 * @returns A single JSON:API document (not multiple loose objects).
 *
 * @example
 * ```ts
 * const body = buildSubscriptionItemUpdateBody(1, { quantity: 3 });
 * await updateSubscriptionItem(http, 1, body);
 * ```
 */
export const buildSubscriptionItemUpdateBody = (
  subscriptionItemId: string | number,
  attributes: SubscriptionItemUpdateAttributes,
): unknown => {
  return {
    data: {
      type: "subscription-items",
      id: String(subscriptionItemId),
      attributes,
    },
  };
};

/**
 * Update a subscription item (PATCH /v1/subscription-items/:id).
 * Docs: https://docs.lemonsqueezy.com/api/subscription-items/update-subscription-item
 *
 * @param http - Shared API client.
 * @param subscriptionItemId - Item id.
 * @param body - JSON:API update document.
 * @returns The updated subscription item.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const item = await updateSubscriptionItem(
 *   http,
 *   1,
 *   buildSubscriptionItemUpdateBody(1, { quantity: 2 }),
 * );
 * ```
 */
export const updateSubscriptionItem = async (
  http: HttpClient,
  subscriptionItemId: string | number,
  body: unknown,
): Promise<JsonApiResource<SubscriptionItemAttributes>> => {
  return http.patchResource<SubscriptionItemAttributes>(
    `/v1/subscription-items/${subscriptionItemId}`,
    body,
  );
};

/**
 * Current-period usage for a usage-based subscription item.
 * Docs: https://docs.lemonsqueezy.com/api/subscription-items/retrieve-subscription-item-current-usage
 *
 * @param http - Shared API client.
 * @param subscriptionItemId - Item id.
 * @returns Usage payload for the current billing period.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const usage = await getSubscriptionItemCurrentUsage(http, 1);
 * ```
 */
export const getSubscriptionItemCurrentUsage = async (
  http: HttpClient,
  subscriptionItemId: string | number,
): Promise<unknown> => {
  return http.request({
    path: `/v1/subscription-items/${subscriptionItemId}/current-usage`,
  });
};
