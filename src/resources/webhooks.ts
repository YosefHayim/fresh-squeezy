import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

/**
 * Subset of webhook attributes we read. `events` is an ordered list of
 * subscribed event names; the validator cross-references these against the
 * support manifest to catch missing subscriptions.
 */
export interface WebhookAttributes {
  store_id: number;
  url: string;
  events: string[];
  last_sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

export async function listWebhooksForStore(
  http: HttpClient,
  storeId: string | number
): Promise<JsonApiResource<WebhookAttributes>[]> {
  return http.getCollection<WebhookAttributes>("/v1/webhooks", {
    "filter[store_id]": String(storeId),
  });
}
