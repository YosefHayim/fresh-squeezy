import type { HttpClient, RequestOptions } from "../core/http.js";
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

export async function getSubscriptionItem(
  http: HttpClient,
  subscriptionItemId: string | number,
): Promise<JsonApiResource<SubscriptionItemAttributes>> {
  return http.getResource<SubscriptionItemAttributes>(
    `/v1/subscription-items/${subscriptionItemId}`,
  );
}

export async function listSubscriptionItemsForSubscription(
  http: HttpClient,
  subscriptionId: string | number,
): Promise<JsonApiResource<SubscriptionItemAttributes>[]> {
  return http.paginate<SubscriptionItemAttributes>("/v1/subscription-items", {
    "filter[subscription_id]": String(subscriptionId),
  });
}

export function buildSubscriptionItemUpdateBody(
  subscriptionItemId: string | number,
  attributes: SubscriptionItemUpdateAttributes,
): RequestOptions["body"] {
  return {
    data: {
      type: "subscription-items",
      id: String(subscriptionItemId),
      attributes,
    },
  };
}
