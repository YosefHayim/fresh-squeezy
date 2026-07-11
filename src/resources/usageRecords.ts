import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedUsageRecordAttributes } from "../generated/lemonSqueezyApiTypes.js";

export type UsageRecordAction = "increment" | "set";

export interface UsageRecordAttributes extends GeneratedUsageRecordAttributes {
  subscription_item_id: number;
  quantity: number;
  action: UsageRecordAction;
  created_at?: string;
  updated_at?: string;
}

/**
 * Retrieve a usage record.
 *
 * @param http - Shared API client.
 * @param usageRecordId - Usage record id.
 * @returns The usage record resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const record = await getUsageRecord(http, 1);
 * ```
 */
export const getUsageRecord = async (
  http: HttpClient,
  usageRecordId: string | number,
): Promise<JsonApiResource<UsageRecordAttributes>> => {
  return http.getResource<UsageRecordAttributes>(`/v1/usage-records/${usageRecordId}`);
};

/**
 * List usage records for a subscription item.
 *
 * @param http - Shared API client.
 * @param subscriptionItemId - Parent subscription item id.
 * @returns Usage record resources.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const records = await listUsageRecordsForSubscriptionItem(http, 1);
 * ```
 */
export const listUsageRecordsForSubscriptionItem = async (
  http: HttpClient,
  subscriptionItemId: string | number,
): Promise<JsonApiResource<UsageRecordAttributes>[]> => {
  return http.paginate<UsageRecordAttributes>("/v1/usage-records", {
    "filter[subscription_item_id]": String(subscriptionItemId),
  });
};

/**
 * Create a usage record (POST /v1/usage-records).
 * Docs: https://docs.lemonsqueezy.com/api/usage-records/create-usage-record
 *
 * @param http - Shared API client.
 * @param body - JSON:API create document.
 * @returns The created usage record.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const record = await createUsageRecord(http, {
 *   data: {
 *     type: "usage-records",
 *     attributes: { quantity: 5, action: "increment" },
 *     relationships: {
 *       "subscription-item": { data: { type: "subscription-items", id: "1" } },
 *     },
 *   },
 * });
 * ```
 */
export const createUsageRecord = async (
  http: HttpClient,
  body: unknown,
): Promise<JsonApiResource<UsageRecordAttributes>> => {
  return http.postResource<UsageRecordAttributes>("/v1/usage-records", body);
};
