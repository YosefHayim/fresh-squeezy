/**
 * Type augmentation building blocks.
 *
 * The official `@lemonsqueezy/lemonsqueezy.js` SDK uses type aliases
 * (`type Subscription = Omit<...>`) — not interfaces — so its types cannot
 * be augmented via `declare module`. This module ships the bring-your-own
 * intersection pattern instead: the consumer combines their existing
 * resource type with the matching `Latest*Fields` type and gets the new
 * platform fields without hand-rolling the additions.
 *
 * `fresh-squeezy types:augment` (CLI) writes a small `.d.ts` to the
 * consumer's project that wires this up against either the official SDK
 * or hand-rolled local types. Consumers can also use these types directly
 * when they prefer to control the wiring themselves.
 *
 * Field provenance lives in `src/support/manifest.ts ::
 * ACKNOWLEDGED_CHANGELOG_ENTRIES` so the tables stay in lockstep.
 */

/**
 * Subscription fields fresh-squeezy knows about that the official SDK
 * (and most hand-rolled types written before mid-2024) is silent on.
 */
export interface LatestSubscriptionFields {
  /** Added 2025-06-11. Identifies which payment provider processed the transaction. */
  payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string;
  /** Added 2024-02-05 (subscription invoice surface). */
  tax_inclusive?: boolean;
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
 * Order fields added since 2024-01 that consumers commonly need to read.
 */
export interface LatestOrderFields {
  /** Added 2024-09-10. Manual fraud flag. Treat as terminal. */
  status?:
    | "pending"
    | "failed"
    | "paid"
    | "refunded"
    | "fraudulent"
    | "partial_refund";
  /** Added 2024-02-05. */
  tax_inclusive?: boolean;
  /** Added 2024-08-07. Refund-amount fields, useful for reconciling partials. */
  refunded_amount?: number;
  refunded_amount_usd?: number | null;
  refunded_amount_formatted?: string | null;
  /** Added 2024-01-21 on subscription invoice — also surfaces on Order. */
  setup_fee?: number;
}

/**
 * Variant fields added since 2024-06.
 */
export interface LatestVariantFields {
  /** Added 2024-06-09. Hosted-checkout / customer-portal links keyed by purpose. */
  links?: Record<string, string>;
}

/**
 * Price fields added in early 2024.
 */
export interface LatestPriceFields {
  /** Added 2024-01-21. */
  setup_fee_enabled?: boolean;
  /** Added 2024-01-21. Setup fee in cents, paired with `setup_fee_enabled`. */
  setup_fee?: number | null;
  /** Added 2024-01-15. Decimal string for sub-cent accuracy. */
  unit_price_decimal?: string | null;
}

/**
 * Map a resource label to its `Latest*Fields` shape. Used by the
 * `WithLatestLemonSqueezyFields` helper so the consumer writes one line
 * per resource:
 *
 *   type MySubscription = WithLatestLemonSqueezyFields<OfficialSub, "subscription">;
 *
 * Adding a new resource? Extend this mapping and the corresponding
 * `Latest*Fields` interface in lockstep.
 */
export interface LatestLemonSqueezyFieldMap {
  subscription: LatestSubscriptionFields;
  order: LatestOrderFields;
  variant: LatestVariantFields;
  price: LatestPriceFields;
}

/**
 * Intersect a base type with the latest known fields for the given
 * resource label. Convenience over `T & LatestSubscriptionFields` because
 * the resource string is easier to remember and lints cleanly.
 */
export type WithLatestLemonSqueezyFields<
  T,
  R extends keyof LatestLemonSqueezyFieldMap,
> = T & LatestLemonSqueezyFieldMap[R];
