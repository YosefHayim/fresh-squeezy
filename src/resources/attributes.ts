import type { JsonApiDocument } from "../core/types.js";
import type {
  GeneratedAffiliateAttributes,
  GeneratedCheckoutAttributes,
  GeneratedCustomerAttributes,
  GeneratedDiscountAttributes,
  GeneratedDiscountRedemptionAttributes,
  GeneratedFileAttributes,
  GeneratedLicenseKeyAttributes,
  GeneratedLicenseKeyInstanceAttributes,
  GeneratedOrderAttributes,
  GeneratedOrderItemAttributes,
  GeneratedPriceAttributes,
  GeneratedProductAttributes,
  GeneratedStoreAttributes,
  GeneratedSubscriptionAttributes,
  GeneratedSubscriptionInvoiceAttributes,
  GeneratedSubscriptionItemAttributes,
  GeneratedUsageRecordAttributes,
  GeneratedUserAttributes,
  GeneratedVariantAttributes,
  GeneratedWebhookAttributes,
} from "../generated/lemonSqueezyApiTypes.js";

/**
 * Typed attributes for every Lemon Squeezy object fresh-squeezy touches.
 *
 * Each `*Attributes` extends the docs-generated `Generated*Attributes` and
 * tightens the fields validators rely on. Ops return `unknown`; narrow with
 * these, e.g. `(await lemon.orders.get(1)) as JsonApiResource<OrderAttributes>`.
 */

/**
 * Subset of the Lemon Squeezy `users` resource attributes we rely on.
 * Full schema at https://docs.lemonsqueezy.com/api/users.
 */
export interface UserAttributes extends GeneratedUserAttributes {
  name: string;
  email: string;
  color?: string;
  avatar_url?: string | null;
  has_custom_avatar?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Document-level metadata on `/v1/users/me`.
 *
 * `test_mode` was added to the endpoint on 2024-01-05 (per the Lemon Squeezy
 * API changelog: https://docs.lemonsqueezy.com/api/getting-started/changelog).
 * It reports whether the *key* being used is a test-mode key, independent of
 * what the caller declared. The connection validator compares this against
 * the caller's declared mode to catch the common "prod key in staging"
 * (or vice versa) misconfiguration.
 */
export interface UserMeta {
  test_mode?: boolean;
}

/**
 * Authenticated-user document with the `data` + `meta` block preserved.
 * The connection validator needs the meta flag, so it reads the full
 * `/v1/users/me` document rather than just `data`.
 */
export type AuthenticatedUserDocument = JsonApiDocument<UserAttributes> & { meta?: UserMeta };

/**
 * Subset of store attributes fresh-squeezy reads.
 * Full schema at https://docs.lemonsqueezy.com/api/stores.
 */
export interface StoreAttributes extends GeneratedStoreAttributes {
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

/**
 * Subset of product attributes we need for validation. `status` drives the
 * "unpublished product" check; `store_id` drives ownership checks.
 */
export interface ProductAttributes extends GeneratedProductAttributes {
  name: string;
  slug: string;
  description?: string | null;
  status: "draft" | "published";
  status_formatted?: string;
  store_id: number;
  buy_now_url?: string | null;
  from_price?: number | null;
  to_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface VariantLink {
  title: string;
  url: string;
}

/**
 * Variant attributes used by the product validator to detect
 * variant/price drift from the product they belong to.
 */
export interface VariantAttributes extends GeneratedVariantAttributes {
  product_id: number;
  name: string;
  slug: string;
  description?: string | null;
  has_license_keys?: boolean;
  license_activation_limit?: number | null;
  is_license_limit_unlimited?: boolean;
  license_length_value?: number | null;
  license_length_unit?: "day" | "week" | "month" | "year" | null;
  is_license_length_unlimited?: boolean;
  status: "pending" | "draft" | "published";
  status_formatted?: string;
  is_subscription?: boolean;
  interval?: string | null;
  interval_count?: number | null;
  sort?: number;
  /**
   * Hosted-checkout-style links keyed by purpose. Added 2024-06-09 — older
   * SDK and validator versions don't surface this field, so consumers had
   * to read `meta.product_links` manually before. Optional because the
   * field is absent on older variants.
   */
  links?: VariantLink[] | Record<string, string>;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

/**
 * Extended variant attributes for subscription plan validation. In Lemon
 * Squeezy, "subscription plans" live as variants with `is_subscription: true`.
 * These fields are only present on subscription variants and are checked by
 * the subscription plan validator to catch misconfigured trial periods,
 * zero-price plans, and invalid billing intervals.
 */
export interface SubscriptionVariantAttributes extends VariantAttributes {
  is_subscription: boolean;
  interval: string | null;
  interval_count: number | null;
  has_free_trial: boolean;
  trial_interval: string | null;
  trial_interval_count: number | null;
  price: number;
}

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
 * Lemon Squeezy file attributes, generated from the public object docs.
 * Exposed so consumers can type file-resource escape-hatch calls without
 * waiting for a hand-written validator.
 */
export interface FileAttributes extends GeneratedFileAttributes {}

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

export interface OrderUrls {
  receipt?: string;
}

export interface OrderFirstItem {
  id: number;
  order_id?: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  price: number;
  quantity?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Subset of Lemon Squeezy order attributes fresh-squeezy understands.
 *
 * fresh-squeezy does not (yet) validate orders — the type is exported so
 * consumers using the raw `client.request<OrderAttributes>()` escape hatch
 * get a typed response that includes platform additions the official SDK
 * has not yet picked up.
 *
 * Field provenance against the changelog
 * (https://docs.lemonsqueezy.com/api/getting-started/changelog):
 *
 *   - `status: "fraudulent"` — added 2024-09-10. Indicates a manual fraud
 *     flag; treat as terminal and refund or chargeback as appropriate.
 *   - `refunded_amount`, `refunded_amount_usd`, `refunded_amount_formatted`
 *     — added 2024-08-07. Useful for consumers reconciling partial refunds.
 *   - `tax_inclusive` — added 2024-02-05.
 */
export interface OrderAttributes extends GeneratedOrderAttributes {
  store_id: number;
  customer_id?: number;
  identifier: string;
  order_number: number;
  user_name: string;
  user_email: string;
  currency: string;
  currency_rate: string;
  subtotal: number;
  setup_fee?: number;
  discount_total: number;
  tax: number;
  tax_inclusive?: boolean;
  total: number;
  refunded_amount?: number;
  subtotal_usd?: number;
  setup_fee_usd?: number;
  discount_total_usd?: number;
  tax_usd?: number;
  total_usd?: number;
  refunded_amount_usd?: number | null;
  tax_name?: string | null;
  tax_rate?: number | string | null;
  refunded_amount_formatted?: string | null;
  refunded?: boolean;
  refunded_at?: string | null;
  status: "pending" | "failed" | "paid" | "refunded" | "fraudulent" | "partial_refund";
  status_formatted: string;
  subtotal_formatted?: string;
  setup_fee_formatted?: string;
  discount_total_formatted?: string;
  tax_formatted?: string;
  total_formatted?: string;
  first_order_item?: OrderFirstItem | null;
  urls?: OrderUrls;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

/**
 * Order item attributes. `quantity` was added to the documented object in
 * the 2024-12-06 changelog and is needed for multi-quantity reconciliation.
 */
export interface OrderItemAttributes extends GeneratedOrderItemAttributes {
  order_id: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  price: number;
  quantity: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * URLs Lemon Squeezy attaches to a subscription so consumers can deep-link
 * users to billing pages. The set has grown over time; we keep optional
 * fields for forward-compatibility.
 */
export interface SubscriptionUrls {
  update_payment_method?: string;
  customer_portal?: string;
  /** Added 2024-02-20: lets consumers offer "manage subscription" without an extra round-trip. */
  update_customer_portal?: string | null;
  /** Current API examples also surface this key name for PayPal update flows. */
  customer_portal_update_subscription?: string | null;
}

export interface SubscriptionPause {
  mode: "void" | "free" | string;
  resumes_at?: string | null;
}

export interface SubscriptionItemSummary {
  id: number;
  subscription_id: number;
  price_id: number;
  quantity: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Subset of subscription attributes. fresh-squeezy does not (yet) validate
 * subscriptions — this type is exported so consumers using the raw
 * `client.request<SubscriptionAttributes>()` escape hatch get a typed
 * response that includes platform additions the official SDK has not yet
 * picked up.
 *
 * Field provenance against the changelog:
 *   - `payment_processor` — added 2025-06-11.
 *   - `urls.update_customer_portal` — added 2024-02-20.
 *   - `tax_inclusive` — invoice-only in current API docs; retained here as
 *     a compatibility field for consumers that previously normalised
 *     subscription and subscription invoice payloads together.
 */
export interface SubscriptionAttributes extends GeneratedSubscriptionAttributes {
  store_id: number;
  customer_id: number;
  order_id?: number;
  order_item_id?: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  user_name: string;
  user_email: string;
  status: "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";
  status_formatted: string;
  card_brand?: string | null;
  card_last_four?: string | null;
  /** Added 2025-06-11. Identifies which payment provider processed the transaction. */
  payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string;
  pause?: SubscriptionPause | null;
  cancelled?: boolean;
  trial_ends_at?: string | null;
  billing_anchor?: number;
  first_subscription_item?: SubscriptionItemSummary | null;
  urls?: SubscriptionUrls;
  renews_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
  /** Compatibility field for older fresh-squeezy consumers; prefer SubscriptionInvoiceAttributes.tax_inclusive. */
  tax_inclusive?: boolean;
}

export interface SubscriptionItemAttributes extends GeneratedSubscriptionItemAttributes {
  subscription_id: number;
  price_id: number;
  quantity: number;
  is_usage_based: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Attributes accepted by the update subscription item endpoint. The proration
 * controls were added in the 2024-02-12 changelog.
 */
export interface SubscriptionItemUpdateAttributes {
  quantity?: number;
  invoice_immediately?: boolean;
  disable_prorations?: boolean;
}

/**
 * Build a JSON:API update body for a subscription item (quantity / proration).
 *
 * @param subscriptionItemId - Item id embedded in the document.
 * @param attributes - Fields accepted by the update endpoint.
 * @returns A single JSON:API document (not multiple loose objects).
 *
 * @example
 * ```ts
 * const body = buildSubscriptionItemUpdateBody(1, { quantity: 3 });
 * await lemon.subscriptionItems.update(1, body);
 * ```
 */
export const buildSubscriptionItemUpdateBody = (
  subscriptionItemId: string | number,
  attributes: SubscriptionItemUpdateAttributes,
): unknown => {
  return {
    data: {
      type: "subscription-items",
      id: String(subscriptionItemId),
      attributes,
    },
  };
};

export type SubscriptionInvoiceStatus = "pending" | "paid" | "void" | "refunded" | "partial_refund";

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

export type UsageRecordAction = "increment" | "set";

export interface UsageRecordAttributes extends GeneratedUsageRecordAttributes {
  subscription_item_id: number;
  quantity: number;
  action: UsageRecordAction;
  created_at?: string;
  updated_at?: string;
}

/**
 * Subset of Lemon Squeezy discount attributes used by the discount validator.
 * Full schema at https://docs.lemonsqueezy.com/api/discounts.
 */
export interface DiscountAttributes extends GeneratedDiscountAttributes {
  name: string;
  code: string;
  amount: number;
  amount_type: "percent" | "fixed";
  is_limited_to_products: boolean;
  is_limited_redemptions: boolean;
  max_redemptions: number;
  starts_at: string | null;
  expires_at: string | null;
  status: "draft" | "published";
  duration: "once" | "repeating" | "forever";
  store_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface DiscountRedemptionAttributes extends GeneratedDiscountRedemptionAttributes {
  discount_id: number;
  order_id: number;
  discount_name: string;
  discount_code: string;
  discount_amount: number;
  discount_amount_type: "percent" | "fixed";
  amount: number;
  created_at?: string;
  updated_at?: string;
}

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

export interface LicenseKeyInstanceAttributes extends GeneratedLicenseKeyInstanceAttributes {
  license_key_id: number;
  identifier: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

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

/**
 * Subset of webhook attributes we read. `events` is an ordered list of
 * subscribed event names; the validator cross-references these against the
 * support manifest to catch missing subscriptions.
 */
export interface WebhookAttributes extends GeneratedWebhookAttributes {
  store_id: number;
  url: string;
  events: string[];
  last_sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
  test_mode?: boolean;
}

export type AffiliateStatus = "active" | "pending" | "disabled";

/**
 * Affiliate attributes added with the 2025-01-21 Affiliates API surface.
 * No validator consumes these yet; they type `lemon.affiliates.*` results.
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
