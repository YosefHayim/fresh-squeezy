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

/**
 * Retrieve a customer (GET /v1/customers/:id).
 *
 * @param http - Shared API client.
 * @param customerId - Customer id.
 * @returns The customer resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const customer = await getCustomer(http, 1);
 * ```
 */
export const getCustomer = async (
  http: HttpClient,
  customerId: string | number,
): Promise<JsonApiResource<CustomerAttributes>> => {
  return http.getResource<CustomerAttributes>(`/v1/customers/${customerId}`);
};

/**
 * List customers for a store.
 *
 * @param http - Shared API client.
 * @param storeId - Store filter.
 * @returns Customer resources.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const customers = await listCustomersForStore(http, 1);
 * ```
 */
export const listCustomersForStore = async (
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<CustomerAttributes>[]> => {
  return http.paginate<CustomerAttributes>("/v1/customers", {
    "filter[store_id]": String(storeId),
  });
};

/**
 * Create a customer (POST /v1/customers).
 * Docs: https://docs.lemonsqueezy.com/api/customers/create-customer
 *
 * @param http - Shared API client.
 * @param body - JSON:API create document.
 * @returns The created customer.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const customer = await createCustomer(http, {
 *   data: {
 *     type: "customers",
 *     attributes: { name: "Ada", email: "ada@example.com" },
 *     relationships: { store: { data: { type: "stores", id: "1" } } },
 *   },
 * });
 * ```
 */
export const createCustomer = async (
  http: HttpClient,
  body: unknown,
): Promise<JsonApiResource<CustomerAttributes>> => {
  return http.postResource<CustomerAttributes>("/v1/customers", body);
};

/**
 * Update a customer (PATCH /v1/customers/:id).
 * Docs: https://docs.lemonsqueezy.com/api/customers/update-customer
 *
 * @param http - Shared API client.
 * @param customerId - Customer id.
 * @param body - JSON:API update document.
 * @returns The updated customer.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const customer = await updateCustomer(http, 1, {
 *   data: { type: "customers", id: "1", attributes: { name: "Ada Lovelace" } },
 * });
 * ```
 */
export const updateCustomer = async (
  http: HttpClient,
  customerId: string | number,
  body: unknown,
): Promise<JsonApiResource<CustomerAttributes>> => {
  return http.patchResource<CustomerAttributes>(`/v1/customers/${customerId}`, body);
};
