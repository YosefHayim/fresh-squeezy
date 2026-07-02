import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedCheckoutAttributes } from "../generated/lemonSqueezyApiTypes.js";

export type CheckoutLocale =
  | "bg"
  | "hr"
  | "cs"
  | "da"
  | "nl"
  | "en"
  | "et"
  | "fil"
  | "fi"
  | "fr"
  | "de"
  | "el"
  | "hu"
  | "id"
  | "it"
  | "ja"
  | "ko"
  | "lv"
  | "lt"
  | "ms"
  | "mt"
  | "pl"
  | "pt"
  | "ro"
  | "ru"
  | "zh-CN"
  | "sk"
  | "sl"
  | "es"
  | "sv"
  | "th"
  | "tr"
  | "vi";

export interface CheckoutProductOptions {
  name?: string;
  description?: string;
  media?: string[];
  redirect_url?: string;
  receipt_button_text?: string;
  receipt_link_url?: string;
  receipt_thank_you_note?: string;
  enabled_variants?: number[];
}

export interface CheckoutOptions {
  embed?: boolean;
  media?: boolean;
  logo?: boolean;
  desc?: boolean;
  discount?: boolean;
  subscription_preview?: boolean;
  /** Added 2024-03-28. */
  skip_trial?: boolean;
  /** Deprecated 2024-09-04; keep typed so old payloads still compile. */
  dark?: boolean;
  background_color?: string;
  headings_color?: string;
  primary_text_color?: string;
  secondary_text_color?: string;
  links_color?: string;
  borders_color?: string;
  checkbox_color?: string;
  active_state_color?: string;
  button_color?: string;
  button_text_color?: string;
  terms_privacy_color?: string;
  locale?: CheckoutLocale | string | null;
}

export interface CheckoutVariantQuantity {
  variant_id: number;
  quantity: number;
}

export interface CheckoutData {
  email?: string;
  name?: string;
  billing_address?: {
    country?: string;
    zip?: string;
  };
  tax_number?: string;
  discount_code?: string;
  custom?: Record<string, unknown>;
  /** Added 2023-08-23 for multi-variant checkout quantities. */
  variant_quantities?: CheckoutVariantQuantity[];
}

export interface CheckoutPreview {
  currency: string;
  currency_rate: number | string;
  subtotal: number;
  discount_total: number;
  tax: number;
  total: number;
  subtotal_usd: number;
  discount_total_usd: number;
  tax_usd: number;
  total_usd: number;
  subtotal_formatted: string;
  discount_total_formatted: string;
  tax_formatted: string;
  total_formatted: string;
}

export interface CheckoutAttributes extends GeneratedCheckoutAttributes {
  store_id: number;
  variant_id: number;
  custom_price?: number | null;
  product_options?: CheckoutProductOptions;
  checkout_options?: CheckoutOptions;
  checkout_data?: CheckoutData;
  preview?: CheckoutPreview;
  expires_at?: string | null;
  url?: string;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

export async function getCheckout(
  http: HttpClient,
  checkoutId: string | number,
): Promise<JsonApiResource<CheckoutAttributes>> {
  return http.getResource<CheckoutAttributes>(`/v1/checkouts/${checkoutId}`);
}

export async function listCheckoutsForStore(
  http: HttpClient,
  storeId: string | number,
): Promise<JsonApiResource<CheckoutAttributes>[]> {
  return http.paginate<CheckoutAttributes>("/v1/checkouts", {
    "filter[store_id]": String(storeId),
  });
}
