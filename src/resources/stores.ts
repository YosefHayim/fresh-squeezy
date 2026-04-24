import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

/**
 * Subset of store attributes fresh-squeezy reads.
 * Full schema at https://docs.lemonsqueezy.com/api/stores.
 */
export interface StoreAttributes {
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

export async function listStores(http: HttpClient): Promise<JsonApiResource<StoreAttributes>[]> {
  return http.getCollection<StoreAttributes>("/v1/stores");
}
