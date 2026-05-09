import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedAffiliateAttributes } from "../generated/lemonSqueezyApiTypes.js";

export type AffiliateStatus = "active" | "pending" | "disabled";

/**
 * Affiliate attributes added with the 2025-01-21 Affiliates API surface.
 * No validator consumes these yet; the helpers give typed access while
 * preserving the raw request escape hatch for mutations and includes.
 */
export interface AffiliateAttributes extends GeneratedAffiliateAttributes {
  store_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  share_domain: string;
  status: AffiliateStatus;
  application_note?: string | null;
  products?: unknown;
  total_earnings: number;
  unpaid_earnings: number;
  created_at?: string;
  updated_at?: string;
}

export async function getAffiliate(
  http: HttpClient,
  affiliateId: string | number
): Promise<JsonApiResource<AffiliateAttributes>> {
  return http.getResource<AffiliateAttributes>(`/v1/affiliates/${affiliateId}`);
}

export async function listAffiliatesForStore(
  http: HttpClient,
  storeId: string | number
): Promise<JsonApiResource<AffiliateAttributes>[]> {
  return http.paginate<AffiliateAttributes>("/v1/affiliates", {
    "filter[store_id]": String(storeId),
  });
}
