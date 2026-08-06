import type {
  GeneratedLemonSqueezyFieldMap,
  GeneratedLemonSqueezyResourceName,
} from "./generated/lemonSqueezyApiTypes.js";

export type {
  GeneratedLemonSqueezyFieldMap,
  GeneratedLemonSqueezyResourceName,
  GeneratedLemonSqueezyResourceType,
} from "./generated/lemonSqueezyApiTypes.js";

/**
 * Type augmentation building blocks.
 *
 * Official `@lemonsqueezy/lemonsqueezy.js` types are aliases (`type X = Omit<…>`),
 * not interfaces, so `declare module` cannot patch them. Consumers intersect
 * their base type with `Latest*Fields` (or `WithLatestLemonSqueezyFields`)
 * instead of hand-rolling changelog deltas.
 *
 * `fresh-squeezy types:augment` can emit a small `.d.ts` that wires this to
 * the official SDK or local types; direct imports work the same way.
 *
 * Hand-written `Latest*` maps stay aligned with
 * `ACKNOWLEDGED_CHANGELOG_ENTRIES` in `src/support/manifest.ts`. Resources
 * without a hand-written map fall through to generated docs fields.
 */

/**
 * Subscription fields fresh-squeezy knows about that the official SDK
 * (and most hand-rolled types written before mid-2024) is silent on.
 */
export interface LatestSubscriptionFields {
  /** Added 2025-06-11. Identifies which payment provider processed the transaction. */
  payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string;
  /**
   * Updates `urls` to include `update_customer_portal` (added 2024-02-20)
   * while preserving whatever the base type already declares.
   */
  urls?: {
    update_payment_method?: string;
    customer_portal?: string;
    update_customer_portal?: string;
    [other: string]: string | undefined;
  };
}

/**
 * Subscription invoice fields added after the original Subscription Invoice
 * surface shipped.
 */
export interface LatestSubscriptionInvoiceFields {
  /** Added 2023-08-14. */
  customer_id?: number;
  user_name?: string;
  user_email?: string;
  /** Added 2024-02-05. */
  tax_inclusive?: boolean;
  /** Added 2024-08-07. Refund-amount fields, useful for reconciling partials. */
  refunded_amount?: number;
  refunded_amount_usd?: number | null;
  refunded_amount_formatted?: string | null;
}

/**
 * Order fields added since 2024-01 that consumers commonly need to read.
 */
export interface LatestOrderFields {
  /** Added 2024-09-10. Manual fraud flag. Treat as terminal. */
  status?: "pending" | "failed" | "paid" | "refunded" | "fraudulent" | "partial_refund";
  /** Added 2024-02-05. */
  tax_inclusive?: boolean;
  /** Added 2024-08-07. Refund-amount fields, useful for reconciling partials. */
  refunded_amount?: number;
  refunded_amount_usd?: number | null;
  refunded_amount_formatted?: string | null;
  /** Added 2024-01-21 on subscription invoice — also surfaces on Order. */
  setup_fee?: number;
  setup_fee_usd?: number;
  setup_fee_formatted?: string;
  /** Added 2023-03-30. */
  urls?: {
    receipt?: string;
    [other: string]: string | undefined;
  };
}

/**
 * Order item fields added since late 2024.
 */
export interface LatestOrderItemFields {
  /** Added 2024-12-06. */
  quantity?: number;
}

/**
 * Variant fields added since 2024-06.
 */
export interface LatestVariantFields {
  /** Added 2024-06-09. Hosted-checkout / customer-portal links keyed by purpose. */
  links?: Array<{ title: string; url: string }> | Record<string, string>;
}

/**
 * Price fields added in early 2024.
 */
export interface LatestPriceFields {
  /** Added 2024-01-21. */
  setup_fee_enabled?: boolean | null;
  /** Added 2024-01-21. Setup fee in cents, paired with `setup_fee_enabled`. */
  setup_fee?: number | null;
  /** Added 2024-01-15. Decimal string for sub-cent accuracy. */
  unit_price_decimal?: string | null;
}

export interface LatestCheckoutOptionsFields {
  /** Added 2024-03-28. */
  skip_trial?: boolean;
  /** Deprecated 2024-09-04; color options below replace this flag. */
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
}

export interface LatestCheckoutDataFields {
  /** Added 2023-08-23. */
  variant_quantities?: Array<{ variant_id: number; quantity: number }>;
}

export interface LatestCheckoutFields {
  checkout_options?: LatestCheckoutOptionsFields & Record<string, unknown>;
  checkout_data?: LatestCheckoutDataFields & Record<string, unknown>;
}

export interface LatestSubscriptionItemUpdateFields {
  /** Added 2024-02-12. */
  invoice_immediately?: boolean;
  /** Added 2024-02-12. */
  disable_prorations?: boolean;
}

/**
 * Hand-written changelog field map. Prefer this over generated fields when
 * both exist (SDK lag + explicit provenance dates).
 *
 * @example
 * ```ts
 * type MySubscription = WithLatestLemonSqueezyFields<OfficialSub, "subscription">;
 * ```
 */
export interface LatestLemonSqueezyFieldMap {
  subscription: LatestSubscriptionFields;
  subscriptionInvoice: LatestSubscriptionInvoiceFields;
  subscriptionItemUpdate: LatestSubscriptionItemUpdateFields;
  order: LatestOrderFields;
  orderItem: LatestOrderItemFields;
  variant: LatestVariantFields;
  price: LatestPriceFields;
  checkout: LatestCheckoutFields;
}

/** Resource labels accepted by `WithLatestLemonSqueezyFields` / `LatestFieldsFor`. */
export type LatestLemonSqueezyResourceName =
  | keyof LatestLemonSqueezyFieldMap
  | GeneratedLemonSqueezyResourceName;

/**
 * Resolve latest fields for a resource label: hand-written map first, then
 * generated docs attributes for the rest of the catalog.
 */
export type LatestFieldsFor<R extends LatestLemonSqueezyResourceName> =
  R extends keyof LatestLemonSqueezyFieldMap
    ? LatestLemonSqueezyFieldMap[R]
    : R extends GeneratedLemonSqueezyResourceName
      ? GeneratedLemonSqueezyFieldMap[R]
      : never;

/**
 * Intersect a base resource type with the latest known fields for label `R`.
 * Prefer this over writing `T & LatestSubscriptionFields` by hand.
 */
export type WithLatestLemonSqueezyFields<T, R extends LatestLemonSqueezyResourceName> = T &
  LatestFieldsFor<R>;
