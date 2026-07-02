import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedPriceAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Subset of Lemon Squeezy price attributes. Prices are nested under
 * variants in the API surface; consumers that read them directly via
 * `client.request<PriceAttributes>()` get a typed response that includes
 * the setup-fee fields the official SDK does not yet surface.
 *
 * Field provenance:
 *   - `setup_fee_enabled`, `setup_fee` — added 2024-01-21.
 *   - `unit_price_decimal` — added 2024-01-15.
 */
export interface PriceAttributes extends GeneratedPriceAttributes {
  variant_id: number;
  category: "one_time" | "subscription" | "lead_magnet" | "pwyw";
  scheme: "standard" | "package" | "graduated" | "volume";
  usage_aggregation?: string | null;
  unit_price?: number;
  /** Added 2024-01-15. Decimal string for sub-cent accuracy. */
  unit_price_decimal?: string | null;
  package_size?: number;
  tiers?: unknown;
  renewal_interval_unit?: "day" | "week" | "month" | "year" | null;
  renewal_interval_quantity?: number | null;
  trial_interval_unit?: "day" | "week" | "month" | "year" | null;
  trial_interval_quantity?: number | null;
  min_price?: number | null;
  suggested_price?: number | null;
  tax_code?: string;
  /** Added 2024-01-21. */
  setup_fee_enabled?: boolean | null;
  /** Added 2024-01-21. Setup fee in cents, paired with `setup_fee_enabled`. */
  setup_fee?: number | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch a single price by ID. Provided for consumers reaching the prices
 * endpoint directly — fresh-squeezy reads price information through the
 * subscription plan validator and does not surface a price validator yet.
 */
export async function getPrice(
  http: HttpClient,
  priceId: string | number,
): Promise<JsonApiResource<PriceAttributes>> {
  return http.getResource<PriceAttributes>(`/v1/prices/${priceId}`);
}
