import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";

/**
 * Subset of Lemon Squeezy license-key attributes used by the license key
 * validator. Full schema at https://docs.lemonsqueezy.com/api/license-keys.
 */
export interface LicenseKeyAttributes {
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
 */
export async function getLicenseKey(
  http: HttpClient,
  licenseKeyId: string | number
): Promise<JsonApiResource<LicenseKeyAttributes>> {
  return http.getResource<LicenseKeyAttributes>(`/v1/license-keys/${licenseKeyId}`);
}
