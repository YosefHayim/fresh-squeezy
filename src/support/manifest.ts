import { GENERATED_LEMON_SQUEEZY_RESOURCES } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Support manifest: the locally reviewed source of truth for what
 * fresh-squeezy explicitly understands on the Lemon Squeezy platform.
 *
 * Resource/type coverage is generated from Lemon Squeezy object docs with
 * `npm run generate:api-types`. Validator policy remains reviewed here:
 * when the platform adds new webhook events or behavior, bump the entries
 * below and re-snapshot the changelog page with
 * `npm run check:changelog -- --update`.
 *
 * Changelog source: https://docs.lemonsqueezy.com/api/getting-started/changelog
 * Last reviewed:    2026-05-07
 */

/** Resources fresh-squeezy understands today, generated from object docs. */
export const SUPPORTED_RESOURCES = GENERATED_LEMON_SQUEEZY_RESOURCES;

/**
 * Webhook events fresh-squeezy expects a production integration to subscribe to
 * at minimum. Consumers can still subscribe to more; the validator only flags
 * missing ones from this list.
 *
 * Rationale:
 *   - `order_*` covers one-off purchases and refunds.
 *   - `subscription_*` covers the recurring-billing lifecycle.
 *   - `subscription_payment_*` covers dunning / retry loops.
 *
 * Confirmed present in the Lemon Squeezy webhook topic list as of 2026-04-24.
 */
export const RECOMMENDED_WEBHOOK_EVENTS = [
  "order_created",
  "order_refunded",
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_payment_success",
  "subscription_payment_failed",
] as const;

/**
 * Newer or integration-specific events surfaced as info-level suggestions
 * rather than errors. Missing these is common and not necessarily a
 * misconfiguration.
 *
 * Per-entry changelog provenance (source:
 * https://docs.lemonsqueezy.com/api/getting-started/changelog):
 *
 *   - `customer_updated` — added 2026-02-25. Fires when a customer record
 *     changes (e.g. email, marketing consent). Needed if the app mirrors
 *     customer data locally.
 *   - `affiliate_activated` — added 2025-01-21 alongside the affiliates
 *     endpoints. Only relevant if the store has an affiliate program.
 *   - `license_key_created` / `license_key_updated` — License API events.
 *     Only relevant when variants have `has_license_keys: true`.
 */
export const OPTIONAL_WEBHOOK_EVENTS = [
  "customer_updated",
  "affiliate_activated",
  "license_key_created",
  "license_key_updated",
] as const;

/**
 * Platform additions we have read and decided *not* to validate against yet,
 * documented here so maintainers see the deliberate gap during review.
 *
 * Tracked so the drift workflow has an "expected state" to compare against:
 * if the changelog page changes and none of these items explain it, the diff
 * is probably something new that needs a manifest update.
 */
export const ACKNOWLEDGED_CHANGELOG_ENTRIES = [
  {
    date: "2026-02-25",
    summary: "Added customer_updated webhook event.",
    handledBy: "OPTIONAL_WEBHOOK_EVENTS",
  },
  {
    date: "2025-06-11",
    summary: "Added payment_processor attribute to Subscription objects.",
    handledBy: "Surfaced as SubscriptionAttributes.payment_processor in src/resources/subscriptions.ts.",
  },
  {
    date: "2025-01-21",
    summary: "Added Affiliates endpoints and affiliate_activated webhook.",
    handledBy: "OPTIONAL_WEBHOOK_EVENTS (event only; resource stays v2 scope)",
  },
  {
    date: "2024-12-06",
    summary: "Added quantity parameter to OrderItem objects.",
    handledBy: "OrderItemAttributes.quantity (src/resources/orderItems.ts).",
  },
  {
    date: "2024-09-10",
    summary: "Added fraudulent Order status.",
    handledBy: "OrderAttributes.status union includes 'fraudulent' (src/resources/orders.ts).",
  },
  {
    date: "2024-09-04",
    summary: "Added Issue an Order refund and Issue a Subscription Invoice refund endpoints.",
    handledBy: "Not wrapped — reachable via client.request('/v1/orders/:id/refund'). Refund-amount fields surfaced on OrderAttributes.",
  },
  {
    date: "2024-08-07",
    summary: "Added refunded_amount, refunded_amount_usd, refunded_amount_formatted to Order and Subscription invoice objects.",
    handledBy: "OrderAttributes.refunded_amount*, SubscriptionInvoiceAttributes.refunded_amount*.",
  },
  {
    date: "2024-06-09",
    summary: "Added links property to Variant objects.",
    handledBy: "VariantAttributes.links (src/resources/variants.ts).",
  },
  {
    date: "2024-05-20",
    summary: "Added Generate order invoice endpoint.",
    handledBy: "Not wrapped — reachable via client.request('/v1/orders/:id/generate-invoice').",
  },
  {
    date: "2024-04-09",
    summary: "License Key expires_at is now mutable via the update endpoint.",
    handledBy: "Type unchanged (LicenseKeyAttributes.expires_at already nullable string). Mutation reachable via client.request('PATCH /v1/license-keys/:id').",
  },
  {
    date: "2024-03-28",
    summary: "Subscription trial_ends_at is now mutable via the update endpoint.",
    handledBy:
      "SubscriptionAttributes.trial_ends_at plus CheckoutOptions.skip_trial. Mutations remain reachable via client.request().",
  },
  {
    date: "2024-02-20",
    summary: "Added urls.update_customer_portal to Subscription objects.",
    handledBy: "SubscriptionUrls.update_customer_portal (src/resources/subscriptions.ts).",
  },
  {
    date: "2024-02-12",
    summary: "Added Generate subscription invoice endpoint and invoice_immediately / disable_prorations parameters.",
    handledBy: "SubscriptionItemUpdateAttributes.invoice_immediately / disable_prorations; invoice endpoint reachable via client.request().",
  },
  {
    date: "2024-02-05",
    summary: "Added tax_inclusive parameter to Order objects and Subscription invoice objects.",
    handledBy: "OrderAttributes.tax_inclusive, SubscriptionInvoiceAttributes.tax_inclusive.",
  },
  {
    date: "2024-01-21",
    summary: "Added setup_fee_enabled / setup_fee to Price objects; setup_fee* to Subscription invoice.",
    handledBy: "PriceAttributes.setup_fee*, OrderAttributes.setup_fee*.",
  },
  {
    date: "2024-01-15",
    summary: "Added unit_price_decimal to Price objects.",
    handledBy: "PriceAttributes.unit_price_decimal.",
  },
  {
    date: "2024-01-05",
    summary: "Added test_mode flag to /v1/users/me meta.",
    handledBy:
      "Read in validateConnection to emit MODE_MISMATCH when the key's true mode differs from the caller's declared mode.",
  },
  {
    date: "2023-09-19",
    summary: "Added customer_portal URLs to Subscription and Customer objects.",
    handledBy: "SubscriptionUrls.customer_portal and CustomerUrls.customer_portal.",
  },
  {
    date: "2023-08-23",
    summary: "Added checkout_data.variant_quantities, subscription items, prices, and usage-based billing.",
    handledBy:
      "CheckoutData.variant_quantities, SubscriptionItemAttributes, UsageRecordAttributes, PriceAttributes.",
  },
  {
    date: "2023-08-14",
    summary: "Added customer_id, user_name, user_email to Subscription invoice objects.",
    handledBy: "SubscriptionInvoiceAttributes customer fields.",
  },
  {
    date: "2023-03-30",
    summary: "Added receipt URL to Order objects.",
    handledBy: "OrderUrls.receipt.",
  },
] as const;

export type RecommendedEvent = (typeof RECOMMENDED_WEBHOOK_EVENTS)[number];
export type OptionalEvent = (typeof OPTIONAL_WEBHOOK_EVENTS)[number];
