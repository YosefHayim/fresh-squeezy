import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedCustomerAttributes } from "../generated/lemonSqueezyApiTypes.js";

export type CustomerStatus =
  | "subscribed"
  | "unsubscribed"
  | "archived"
  | "requires_verification"
  | "invalid_email"
  | "bounced";

export interface CustomerUrls {
  customer_portal?: string | null;
}

/**
 * Lemon Squeezy customer attributes. The customer portal URL was called out
 * in the 2023-09-19 changelog and is useful for apps linking users back to
 * billing without another API shape.
 */
export interface CustomerAttributes extends GeneratedCustomerAttributes {
  store_id: number;
  name: string;
  email: string;
  status: CustomerStatus;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  total_revenue_currency: number;
  mrr: number;
  status_formatted: string;
  country_formatted?: string | null;
  total_revenue_currency_formatted: string;
  mrr_formatted: string;
  urls?: CustomerUrls;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

export async function getCustomer(
  http: HttpClient,
  customerId: string | number
): Promise<JsonApiResource<CustomerAttributes>> {
  return http.getResource<CustomerAttributes>(`/v1/customers/${customerId}`);
}

export async function listCustomersForStore(
  http: HttpClient,
  storeId: string | number
): Promise<JsonApiResource<CustomerAttributes>[]> {
  return http.paginate<CustomerAttributes>("/v1/customers", {
    "filter[store_id]": String(storeId),
  });
}
