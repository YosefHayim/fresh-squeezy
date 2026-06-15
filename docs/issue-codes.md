# Issue codes

Every validator returns a stable `ValidationResult` whose issues carry a machine-readable `code`. Switch on `issue.code` in CI logic — **all codes are stable across minor versions**; changes to a code's meaning require a major version bump.

← Back to the [README](../README.md).

## Full reference

| Code | Meaning |
|------|---------|
| `AUTH_FAILED` | Invalid or missing API key |
| `MODE_MISMATCH` | Declared mode doesn't match key's `meta.test_mode` |
| `NETWORK_ERROR` | Lemon Squeezy unreachable |
| `STORE_NOT_FOUND` / `STORE_NOT_OWNED` | Store ID invalid or owned by another account |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | Product can't accept checkout |
| `VARIANT_MISSING` / `VARIANT_UNPUBLISHED` | Product has no live variants |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING` / `WEBHOOK_OPTIONAL_EVENTS` | Webhook URL not registered or under-subscribed |
| `DISCOUNT_DRAFT` / `DISCOUNT_EXPIRED` / `DISCOUNT_NOT_STARTED` / `DISCOUNT_INVALID_AMOUNT` / `DISCOUNT_REDEMPTIONS_EXHAUSTED` / `DISCOUNT_STORE_MISMATCH` | Discount won't apply at checkout |
| `LICENSE_KEY_DISABLED` / `LICENSE_KEY_EXPIRED` / `LICENSE_KEY_AT_ACTIVATION_LIMIT` / `LICENSE_KEY_STORE_MISMATCH` | License key won't activate |
| `PLAN_NOT_SUBSCRIPTION` / `PLAN_INVALID_INTERVAL` / `PLAN_FREE_PRICE` / `PLAN_TRIAL_INCONSISTENT` / `PLAN_DRAFT` / `PLAN_STORE_MISMATCH` | Subscription plan misconfigured |

## Escape hatches

For endpoints not yet wrapped, use the raw request method:

```ts
const user = await lemon.request({ path: "/v1/users/me" });
```

For wrapped-but-not-validated endpoints, import the exported attribute type and use `request()`:

```ts
import type { SubscriptionInvoiceAttributes } from "fresh-squeezy";

const invoice = await lemon.request<{ data: { attributes: SubscriptionInvoiceAttributes } }>({
  path: "/v1/subscription-invoices/123",
});
```

`ValidationResult.target` is optional and identifies the checked resource in human output and JSON when a validator has a product, webhook, store, discount, license key, or variant handle.
