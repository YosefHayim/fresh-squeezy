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

export async function getUsageRecord(
  http: HttpClient,
  usageRecordId: string | number,
): Promise<JsonApiResource<UsageRecordAttributes>> {
  return http.getResource<UsageRecordAttributes>(`/v1/usage-records/${usageRecordId}`);
}

export async function listUsageRecordsForSubscriptionItem(
  http: HttpClient,
  subscriptionItemId: string | number,
): Promise<JsonApiResource<UsageRecordAttributes>[]> {
  return http.paginate<UsageRecordAttributes>("/v1/usage-records", {
    "filter[subscription_item_id]": String(subscriptionItemId),
  });
}
