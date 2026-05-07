# fresh-squeezy

Validator-first Lemon Squeezy doctor. Catches misconfigurations before they ship. CLI + library, Node 20+.

## 30-second start

```bash
npm i -D fresh-squeezy
cp .env.example .env.local                # fill in LEMON_SQUEEZY_API_KEY
npx fresh-squeezy doctor --all-stores
```

No store ID to copy from the dashboard — the CLI discovers reachable stores itself.

| Exit | Meaning |
|------|---------|
| `0`  | All validators passed |
| `1`  | One or more validators reported `error`-level issues |
| `2`  | Fatal (missing key, invalid flags, network failure) |

## What it catches that Postman and the official SDK won't

- **Prod key pointed at staging.** `MODE_MISMATCH` fires when the key's true `meta.test_mode` (API changelog 2024-01-05) disagrees with the declared mode. Doctor exits 1. Neither the SDK nor a hand-rolled wrapper catches this by default.
- **Silent store-ownership mismatches.** Products, discounts, license keys, and subscription plans whose `store_id` doesn't match the store you scoped the run to. Stable codes: `PRODUCT_WRONG_STORE`, `DISCOUNT_STORE_MISMATCH`, `LICENSE_KEY_STORE_MISMATCH`, `PLAN_STORE_MISMATCH`.
- **Webhook subscribed to the wrong events.** Diff against a manifest of recommended events (order/subscription lifecycle, refunds) and newer-but-optional events the SDK doesn't ship.
- **Platform drift.** A weekly GitHub Action hashes the [Lemon Squeezy API changelog](https://docs.lemonsqueezy.com/api/getting-started/changelog) against `src/support/changelog-snapshot.json` and opens an issue when it moves. Tracked additions beyond the official SDK as of 2026-04-24: `customer_updated` (2026-02-25), `payment_processor` on Subscription (2025-06-11), Affiliates + `affiliate_activated` (2025-01-21), `test_mode` on `/v1/users/me` (2024-01-05).
- **Postman + dashboard ping-pong.** One `doctor` call replaces the loop of copying IDs out of the UI, pasting them into env files, and verifying each one by hand.

## CLI

```bash
# TTY: multi-select stores interactively, run doctor on each
npx fresh-squeezy doctor

# Non-interactive: every reachable store
npx fresh-squeezy doctor --all-stores

# Specific stores
npx fresh-squeezy doctor --store-ids 12,34,56

# Scope to a product + webhook
npx fresh-squeezy doctor --store-ids 12 \
  --product-id 987 \
  --webhook-url https://app.example.com/api/webhooks/lemon-squeezy

# Single validator
npx fresh-squeezy validate webhook \
  --store-ids 12,34 \
  --webhook-url https://app.example.com/api/webhooks/lemon-squeezy

# Machine-readable output for CI
npx fresh-squeezy doctor --all-stores --json
```

Store resolution order, used by every store-scoped command:

1. `--store-ids 1,2,3` (comma-separated, explicit)
2. `--all-stores` (every store reachable with the key)
3. TTY: inquirer multi-select prompt
4. No TTY + no flag: connection-only run (useful as a CI smoke check)

## Library

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const lemon = createFreshSqueezy(); // reads LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_MODE

const report = await lemon.doctor({
  storeId: 12,                      // library is single-store per call
  productId: 987,
  webhookUrl: "https://app.example.com/api/webhooks/lemon-squeezy",
});

if (!report.ok) {
  for (const result of report.results) {
    for (const issue of result.issues) {
      console.error(`[${issue.severity}] ${issue.code}: ${issue.message}`);
    }
  }
  process.exit(1);
}
```

For multi-store runs at the library layer, call `doctor()` in a loop. The CLI does exactly this.

Public types: [`FreshSqueezyClient`](src/createFreshSqueezy.ts), [`ValidationResult<T>`](src/core/types.ts), [`DoctorReport`](src/core/types.ts). Switch on `issue.code` in CI logic — codes are stable across minor versions.

## Sandbox vs live

Lemon Squeezy serves both modes from the same API host; mode is determined by the key. `fresh-squeezy` cross-checks the declared mode against `meta.test_mode` from `/v1/users/me`. Mismatch = `MODE_MISMATCH`, doctor exits 1 — the fastest way to catch a prod key pointed at staging before it does damage.

```ts
const lemon = createFreshSqueezy({ mode: "test" });
const result = await lemon.validateConnection();
result.mode;                 // "test" (declared)
result.resource?.actualMode; // "live" — alarm bell
```

The CLI default is `--mode test`. Override with `--mode live`. For nightly platform-drift checks in CI, run `npm run test:live` with `LEMON_SQUEEZY_LIVE_SMOKE=1` and a test-mode key.

## Issue codes

Switch on `issue.code` in CI. All codes are stable across minor versions.

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

For endpoints not yet wrapped, use the raw escape hatch:

```ts
const user = await lemon.request({ path: "/v1/users/me" });
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `LEMON_SQUEEZY_API_KEY` | yes | Bearer token (library + CLI) |
| `LEMON_SQUEEZY_MODE` | no | `test` (default) or `live` |
| `LEMON_SQUEEZY_STORE_ID` | no | Convenience default for `client.doctor()` — library only |

The CLI does not read `LEMON_SQUEEZY_STORE_ID`; use `--store-ids` or `--all-stores` so store selection stays explicit per command.

## Reference

### Validators

- **`validateConnection`** — Reachability, key validity, store presence, declared-vs-actual mode. [→ source](src/validate/connection.ts)
- **`validateStore`** — Store ID exists and is owned by the key's account. [→ source](src/validate/store.ts)
- **`validateProduct`** — Published, on the expected store, has live variants and a buy URL. [→ source](src/validate/product.ts)
- **`validateWebhook`** — Webhook URL registered and subscribed to recommended events. [→ source](src/validate/webhook.ts)
- **`validateDiscount`** — Active, in-window, valid amount, store ownership matches. [→ source](src/validate/discount.ts)
- **`validateLicenseKey`** — Enabled, not expired, activations available, store ownership matches. [→ source](src/validate/licenseKey.ts)
- **`validateSubscriptionPlan`** — Subscription type, valid interval, non-zero price, consistent trial. [→ source](src/validate/subscriptionPlan.ts)
- **`doctor`** — Composes the above into one `DoctorReport`. [→ source](src/validate/doctor.ts)

### CLI commands

- **`doctor`** — Run every configured validator and emit a report. [→ source](src/cli/commands/doctor.ts)
- **`validate <name>`** — Run a single validator. [→ source](src/cli/commands/validate.ts)
- **`init`** — Interactive setup: ask for credentials, pick a store, run doctor. [→ source](src/cli/commands/init.ts)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Clone, `npm install`, `npm test`.

## License

MIT — see [LICENSE](./LICENSE).
