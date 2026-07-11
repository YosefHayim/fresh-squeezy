import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedLicenseKeyAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Subset of Lemon Squeezy license-key attributes used by the license key
 * validator. Full schema at https://docs.lemonsqueezy.com/api/license-keys.
 */
export interface LicenseKeyAttributes extends GeneratedLicenseKeyAttributes {
  key_short: string;
  status: "active" | "inactive" | "expired" | "disabled";
  expires_at: string | null;
  activation_limit: number | null;
  instances_count: number;
  disabled: boolean;
  store_id: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch a single license key by ID. Used by the license key validator to
 * check activation limits, expiration, and store ownership.
 *
 * @param http - Shared API client.
 * @param licenseKeyId - License key id.
 * @returns The license key resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const key = await getLicenseKey(http, 1);
 * ```
 */
export const getLicenseKey = async (
  http: HttpClient,
  licenseKeyId: string | number,
): Promise<JsonApiResource<LicenseKeyAttributes>> => {
  return http.getResource<LicenseKeyAttributes>(`/v1/license-keys/${licenseKeyId}`);
};

/**
 * List license keys for a store.
 *
 * @param http - Shared API client.
 * @param storeId - Store filter.
 * @returns License key resources.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const keys = await listLicenseKeysForStore(http, 1);
 * ```
 */
export const listLicenseKeysForStore = async (
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<LicenseKeyAttributes>[]> => {
  return http.paginate<LicenseKeyAttributes>("/v1/license-keys", {
    "filter[store_id]": String(storeId),
  });
};

/**
 * Update a license key (PATCH /v1/license-keys/:id) — e.g. `expires_at`, disabled.
 * Docs: https://docs.lemonsqueezy.com/api/license-keys/update-license-key
 *
 * @param http - Shared API client.
 * @param licenseKeyId - License key id.
 * @param body - JSON:API update document.
 * @returns The updated license key.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const key = await updateLicenseKey(http, 1, {
 *   data: { type: "license-keys", id: "1", attributes: { disabled: true } },
 * });
 * ```
 */
export const updateLicenseKey = async (
  http: HttpClient,
  licenseKeyId: string | number,
  body: unknown,
): Promise<JsonApiResource<LicenseKeyAttributes>> => {
  return http.patchResource<LicenseKeyAttributes>(`/v1/license-keys/${licenseKeyId}`, body);
};
