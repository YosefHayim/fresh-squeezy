/**
 * Support manifest: the locally reviewed source of truth for what
 * fresh-squeezy explicitly understands on the Lemon Squeezy platform.
 *
 * The plan deliberately favors a static, reviewed manifest over live changelog
 * scraping (see plan.md §Non-goals). When the platform adds new resources,
 * fields, or webhook events, bump the entries below and re-snapshot the
 * changelog page with `npm run check:changelog -- --update`.
 *
 * Changelog source: https://docs.lemonsqueezy.com/api/getting-started/changelog
 * Last reviewed:    2026-04-24
 */

/**
 * Resources fresh-squeezy wraps today. Anything outside this list is still
 * reachable via the raw `request()` escape hatch but has no dedicated
 * validator.
 */
export const SUPPORTED_RESOURCES = [
  "users",
  "stores",
  "products",
  "variants",
  "webhooks",
] as const;

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
    handledBy:
      "Not wrapped — reachable via client.request('/v1/subscriptions/:id'). Add a validator only if a real integration needs it.",
  },
  {
    date: "2025-01-21",
    summary: "Added Affiliates endpoints and affiliate_activated webhook.",
    handledBy: "OPTIONAL_WEBHOOK_EVENTS (event only; resource stays v2 scope)",
  },
  {
    date: "2024-01-05",
    summary: "Added test_mode flag to /v1/users/me meta.",
    handledBy:
      "Read in validateConnection to emit MODE_MISMATCH when the key's true mode differs from the caller's declared mode.",
  },
] as const;

export type RecommendedEvent = (typeof RECOMMENDED_WEBHOOK_EVENTS)[number];
export type OptionalEvent = (typeof OPTIONAL_WEBHOOK_EVENTS)[number];
