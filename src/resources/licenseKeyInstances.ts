import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedLicenseKeyInstanceAttributes } from "../generated/lemonSqueezyApiTypes.js";

export interface LicenseKeyInstanceAttributes extends GeneratedLicenseKeyInstanceAttributes {
  license_key_id: number;
  identifier: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export async function getLicenseKeyInstance(
  http: HttpClient,
  licenseKeyInstanceId: string | number
): Promise<JsonApiResource<LicenseKeyInstanceAttributes>> {
  return http.getResource<LicenseKeyInstanceAttributes>(
    `/v1/license-key-instances/${licenseKeyInstanceId}`
  );
}

export async function listLicenseKeyInstancesForLicenseKey(
  http: HttpClient,
  licenseKeyId: string | number
): Promise<JsonApiResource<LicenseKeyInstanceAttributes>[]> {
  return http.paginate<LicenseKeyInstanceAttributes>("/v1/license-key-instances", {
    "filter[license_key_id]": String(licenseKeyId),
  });
}
