import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedWebhookAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Subset of webhook attributes we read. `events` is an ordered list of
 * subscribed event names; the validator cross-references these against the
 * support manifest to catch missing subscriptions.
 */
export interface WebhookAttributes extends GeneratedWebhookAttributes {
  store_id: number;
  url: string;
  events: string[];
  last_sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

/**
 * Retrieve one webhook by id.
 *
 * @param http - Shared API client.
 * @param webhookId - Webhook id.
 * @returns The webhook resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const webhook = await getWebhook(http, 1);
 * ```
 */
export const getWebhook = async (
  http: HttpClient,
  webhookId: string | number,
): Promise<JsonApiResource<WebhookAttributes>> => {
  return http.getResource<WebhookAttributes>(`/v1/webhooks/${webhookId}`);
};

/**
 * List every webhook registered on the store, walking pagination so a store
 * with more than one page of webhooks doesn't produce a false
 * `WEBHOOK_NOT_FOUND` from `validateWebhook`.
 *
 * @param http - Shared API client.
 * @param storeId - Store to filter.
 * @returns All webhook resources for the store.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const webhooks = await listWebhooksForStore(http, 1);
 * ```
 */
export const listWebhooksForStore = async (
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<WebhookAttributes>[]> => {
  return http.paginate<WebhookAttributes>("/v1/webhooks", {
    "filter[store_id]": String(storeId),
  });
};

/**
 * Create a webhook (POST /v1/webhooks).
 * Docs: https://docs.lemonsqueezy.com/api/webhooks/create-webhook
 *
 * @param http - Shared API client.
 * @param body - JSON:API create document.
 * @returns The created webhook.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const webhook = await createWebhook(http, {
 *   data: {
 *     type: "webhooks",
 *     attributes: { url: "https://app.example.com/hook", events: ["order_created"] },
 *     relationships: { store: { data: { type: "stores", id: "1" } } },
 *   },
 * });
 * ```
 */
export const createWebhook = async (
  http: HttpClient,
  body: unknown,
): Promise<JsonApiResource<WebhookAttributes>> => {
  return http.postResource<WebhookAttributes>("/v1/webhooks", body);
};

/**
 * Update a webhook (PATCH /v1/webhooks/:id).
 * Docs: https://docs.lemonsqueezy.com/api/webhooks/update-webhook
 *
 * @param http - Shared API client.
 * @param webhookId - Webhook id.
 * @param body - JSON:API update document.
 * @returns The updated webhook.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const webhook = await updateWebhook(http, 1, {
 *   data: { type: "webhooks", id: "1", attributes: { events: ["order_created"] } },
 * });
 * ```
 */
export const updateWebhook = async (
  http: HttpClient,
  webhookId: string | number,
  body: unknown,
): Promise<JsonApiResource<WebhookAttributes>> => {
  return http.patchResource<WebhookAttributes>(`/v1/webhooks/${webhookId}`, body);
};

/**
 * Delete a webhook (DELETE /v1/webhooks/:id).
 * Docs: https://docs.lemonsqueezy.com/api/webhooks/delete-webhook
 *
 * @param http - Shared API client.
 * @param webhookId - Webhook id.
 * @returns Nothing on success.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * await deleteWebhook(http, 1);
 * ```
 */
export const deleteWebhook = async (
  http: HttpClient,
  webhookId: string | number,
): Promise<void> => {
  await http.deleteResource(`/v1/webhooks/${webhookId}`);
};
