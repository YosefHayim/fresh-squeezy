# fresh-squeezy

Validator-first Lemon Squeezy setup doctor. Verify your integration before it ships.

The official [`@lemonsqueezy/lemonsqueezy.js`](https://github.com/lmsqueezy/lemonsqueezy.js) SDK is great at making API calls. `fresh-squeezy` answers a different question fast:

> Is my API key pointed at the right store, in the right mode, with a product that is actually published and a webhook subscribed to the events my app relies on?

Library + CLI. One call, one structured report, one exit code.

---

## Install

```bash
npm install fresh-squeezy
# or
pnpm add fresh-squeezy
```

Requires Node.js 20+.

## Setup (90 seconds)

```bash
cp .env.example .env.local
# fill in LEMON_SQUEEZY_API_KEY (test or live)
npx fresh-squeezy doctor --all-stores
```

That's the entire onboarding. No store ID to copy from the dashboard — the CLI discovers reachable stores itself.

## Quick start — CLI

```bash
# TTY: multi-select stores interactively, run doctor on each
npx fresh-squeezy doctor

# Non-interactive: every reachable store
npx fresh-squeezy doctor --all-stores

# Specific stores
npx fresh-squeezy doctor --store-ids 12,34,56

# Scope the run to a product + webhook
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

Exit codes:

| Code | Meaning                                        |
| ---- | ---------------------------------------------- |
| `0`  | All validators passed                          |
| `1`  | One or more validators reported `error`-level  |
| `2`  | Fatal error (missing key, invalid flags, etc.) |

### Store resolution

Resolution order used by every store-scoped command:

1. `--store-ids 1,2,3` (comma-separated, explicit)
2. `--all-stores` (every store reachable with the key)
3. TTY: inquirer multi-select
4. No TTY + no flag: run connection-only (useful as a CI smoke check)

## Quick start — library

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const lemon = createFreshSqueezy(); // reads LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_MODE

const report = await lemon.doctor({
  storeId: 12,                              // library is single-store per call
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

For multi-store runs at the library layer, call `doctor()` in a loop across the store IDs you care about — the CLI does exactly this.

## What it checks

| Validator    | Catches                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `connection` | Invalid key, unreachable account, no stores                                                       |
| `store`      | Wrong store ID, store owned by a different account                                                |
| `product`    | Unpublished product, product on the wrong store, missing or all-draft variants, missing buy URL   |
| `webhook`    | Webhook URL not registered, missing recommended events (order, subscription lifecycle, refunds)   |

Every validator returns the same `ValidationResult` shape — stable public API.

## Sandbox vs live

Lemon Squeezy serves both modes from the same API host. Mode is determined by which key you use. `fresh-squeezy` surfaces the mode on every result **and** cross-checks the declared mode against the key's actual mode using `meta.test_mode` from `/v1/users/me` (API changelog 2024-01-05). If they disagree, `validateConnection` fires `MODE_MISMATCH` as an error and `doctor` exits 1 — that's the fastest way to catch a prod key pointed at staging (or vice versa) before it does damage.

```ts
const lemon = createFreshSqueezy({ mode: "test" });
const result = await lemon.validateConnection();
console.log(result.mode);                 // "test" (declared)
console.log(result.resource?.actualMode); // "live" — alarm bell
```

The CLI default is `--mode test`. Override with `--mode live`.

Live smoke testing in CI: the repo ships an opt-in `npm run test:live` target gated on `LEMON_SQUEEZY_LIVE_SMOKE=1`. Run it nightly with a secret test-mode key so platform drift surfaces before a release.

## API

### `createFreshSqueezy(config?)`

```ts
createFreshSqueezy({
  apiKey?: string;         // default: process.env.LEMON_SQUEEZY_API_KEY
  storeId?: string | number; // optional — also read from env for lib consumers
  mode?: "test" | "live";  // default: process.env.LEMON_SQUEEZY_MODE ?? "test"
  baseUrl?: string;        // default: "https://api.lemonsqueezy.com"
  fetch?: typeof fetch;    // default: globalThis.fetch
});
```

Returns a `FreshSqueezyClient`:

```ts
client.mode
client.request(options)       // raw escape hatch
client.validateConnection()
client.validateStore(id)
client.validateProduct({ productId, expectedStoreId? })
client.validateWebhook({ storeId, url })
client.doctor({ storeId?, productId?, webhookUrl? })
```

### `ValidationResult<T>`

```ts
{
  ok: boolean;
  mode: "test" | "live";
  name: string;
  resource?: T;
  issues: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
    suggestedFix?: string;
    context?: Record<string, string | number | boolean | null>;
  }>;
}
```

Switch on `issue.code` in CI logic — codes are stable across minor versions.

### Raw escape hatch

For endpoints not yet wrapped (new changelog entries, License API, affiliates):

```ts
const user = await lemon.request({ path: "/v1/users/me" });
```

## Environment variables

Only two are required:

| Variable                | Required | Used by           | Purpose                                    |
| ----------------------- | -------- | ----------------- | ------------------------------------------ |
| `LEMON_SQUEEZY_API_KEY` | yes      | library + CLI     | Bearer token                               |
| `LEMON_SQUEEZY_MODE`    | no       | library + CLI     | `test` (default) or `live`                 |
| `LEMON_SQUEEZY_STORE_ID`| no       | library consumers | Convenience default for `client.doctor()`  |

The CLI does **not** read `LEMON_SQUEEZY_STORE_ID` — use `--store-ids` or `--all-stores` so store selection stays explicit per-command.

## Why this exists

1. The official JS SDK ships behind the API changelog. Recent additions tracked in `src/support/manifest.ts`:
   - `2025-01-21` — affiliates endpoints + `affiliate_activated`
   - `2025-06-11` — `payment_processor` on subscriptions
   - `2026-02-25` — `customer_updated` webhook
2. Integration bugs live in configuration, not API calls. Wrong store, wrong mode, missing webhook events are the real failures.
3. Every new product inside a company repeats the same setup checks. This is one place for all of them.

## Scope (v1)

**In**: connection, store, product, webhook validators; `doctor()`; library + CLI; sandbox-mode fixture tests + opt-in live smoke.

**Out**: License API, affiliates, changelog scraper, dashboard UI. On the roadmap for v2 if demand is real.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). TL;DR: clone, `npm install`, `npm test`. Manual QA steps in [docs/MANUAL_QA.md](./docs/MANUAL_QA.md).

## License

MIT — see [LICENSE](./LICENSE).
