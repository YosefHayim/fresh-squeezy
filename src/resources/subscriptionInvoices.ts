import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedSubscriptionInvoiceAttributes } from "../generated/lemonSqueezyApiTypes.js";

export type SubscriptionInvoiceStatus =
  | "pending"
  | "paid"
  | "void"
  | "refunded"
  | "partial_refund";

export type SubscriptionInvoiceBillingReason = "initial" | "renewal" | "updated";

export interface SubscriptionInvoiceUrls {
  invoice_url?: string;
}

/**
 * Subscription invoice attributes, including fields added across the
 * changelog: customer identity, tax inclusion, and partial refund amounts.
 */
export interface SubscriptionInvoiceAttributes extends GeneratedSubscriptionInvoiceAttributes {
  store_id: number;
  subscription_id: number;
  customer_id: number;
  user_name: string;
  user_email: string;
  billing_reason: SubscriptionInvoiceBillingReason | string;
  card_brand?: string | null;
  card_last_four?: string | null;
  currency: string;
  currency_rate: string;
  status: SubscriptionInvoiceStatus;
  status_formatted: string;
  refunded: boolean;
  refunded_at: string | null;
  subtotal: number;
  discount_total: number;
  tax: number;
  tax_inclusive: boolean;
  total: number;
  refunded_amount: number;
  subtotal_usd: number;
  discount_total_usd: number;
  tax_usd: number;
  total_usd: number;
  refunded_amount_usd: number;
  subtotal_formatted: string;
  discount_total_formatted: string;
  tax_formatted: string;
  total_formatted: string;
  refunded_amount_formatted: string;
  urls?: SubscriptionInvoiceUrls;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

export async function getSubscriptionInvoice(
  http: HttpClient,
  subscriptionInvoiceId: string | number
): Promise<JsonApiResource<SubscriptionInvoiceAttributes>> {
  return http.getResource<SubscriptionInvoiceAttributes>(
    `/v1/subscription-invoices/${subscriptionInvoiceId}`
  );
}

export async function listSubscriptionInvoicesForSubscription(
  http: HttpClient,
  subscriptionId: string | number
): Promise<JsonApiResource<SubscriptionInvoiceAttributes>[]> {
  return http.paginate<SubscriptionInvoiceAttributes>("/v1/subscription-invoices", {
    "filter[subscription_id]": String(subscriptionId),
  });
}
