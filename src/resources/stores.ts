import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedStoreAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Subset of store attributes fresh-squeezy reads.
 * Full schema at https://docs.lemonsqueezy.com/api/stores.
 */
export interface StoreAttributes extends GeneratedStoreAttributes {
  name: string;
  slug: string;
  domain?: string | null;
  url?: string | null;
  country?: string;
  currency?: string;
  plan?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getStore(
  http: HttpClient,
  storeId: string | number
): Promise<JsonApiResource<StoreAttributes>> {
  return http.getResource<StoreAttributes>(`/v1/stores/${storeId}`);
}

/**
 * List every store reachable with the configured API key, paginated.
 * Used by `validateConnection` to populate the connection summary, and by
 * the CLI's `--all-stores` flag. Pagination matters here for accounts that
 * own a large catalogue of stores.
 */
export async function listStores(http: HttpClient): Promise<JsonApiResource<StoreAttributes>[]> {
  return http.paginate<StoreAttributes>("/v1/stores");
}
