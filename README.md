<!-- Canonical README. Translations (README.zh-CN.md, README.ja.md, README.es.md, README.pt-BR.md) are derived from this file; English is the source of truth. -->

<p align="center">
  <a href="https://github.com/YosefHayim/fresh-squeezy">
    <img src="public/fresh-squeezy-hero.png" alt="fresh-squeezy — the validator-first doctor for your Lemon Squeezy setup. Catch billing and webhook misconfigurations before they ship." width="640" />
  </a>
</p>

<p align="center">
  <strong>The doctor for your Lemon Squeezy setup — catch billing &amp; webhook misconfigurations before they ship.</strong>
</p>

<!-- Badges. tests count is static; bump it on major test-suite changes. -->
<p align="center">
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/v/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/dm/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm downloads per month" /></a>
  <a href="https://github.com/YosefHayim/fresh-squeezy/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/YosefHayim/fresh-squeezy/ci.yml?branch=main&amp;logo=github&amp;label=CI" alt="CI status" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/fresh-squeezy?color=3fb950" alt="MIT license" /></a>
  <img src="https://img.shields.io/node/v/fresh-squeezy?logo=node.js&amp;logoColor=white&amp;color=339933" alt="Node.js 20 or newer" />
  <img src="https://img.shields.io/npm/types/fresh-squeezy?logo=typescript&amp;logoColor=white" alt="TypeScript types included" />
  <a href="https://packagephobia.com/result?p=fresh-squeezy"><img src="https://packagephobia.com/badge?p=fresh-squeezy" alt="install size" /></a>
  <img src="https://img.shields.io/badge/tests-154%20passing-3fb950?logo=vitest&amp;logoColor=white" alt="154 tests passing" />
</p>

<p align="center">
  <b>English</b> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.pt-BR.md">Português</a>
</p>

<p align="center">
  <a href="#30-second-start">Quick start</a> ·
  <a href="#what-it-catches-that-postman-and-the-official-sdk-wont">What it catches</a> ·
  <a href="#fresh-squeezy-vs-the-alternatives">Comparison</a> ·
  <a href="#cli">CLI</a> ·
  <a href="#library">Library</a> ·
  <a href="#issue-codes">Issue codes</a> ·
  <a href="#faq">FAQ</a>
</p>

---

**fresh-squeezy** is a CLI and TypeScript library that validates your [Lemon Squeezy](https://www.lemonsqueezy.com/) billing integration — stores, products, webhooks, discounts, license keys, and subscription plans — and catches misconfigurations before they ship. Run it as a one-command `doctor` locally or in CI: it returns stable [exit codes](#30-second-start) and machine-readable JSON, and it tracks [Lemon Squeezy API changelog](https://docs.lemonsqueezy.com/api/getting-started/changelog) drift the official SDK hasn't shipped yet. Node 20+.

## 30-second start

```bash
npx fresh-squeezy
```

The first run adds `fresh-squeezy` to devDependencies when it is missing, then starts the guided setup. No store ID to copy from the dashboard — the CLI discovers reachable stores itself. Use `npx fresh-squeezy --no-install` to run the setup without editing `package.json`.

| Exit | Meaning |
|------|---------|
| `0`  | All validators passed |
| `1`  | One or more validators reported `error`-level issues |
| `2`  | Fatal (missing key, invalid flags, network failure) |
| `130` | User cancelled an interactive flow |

## What it catches that Postman and the official SDK won't

- **Prod key pointed at staging.** `MODE_MISMATCH` fires when the key's true `meta.test_mode` (API changelog 2024-01-05) disagrees with the declared mode. Doctor exits 1. Neither the SDK nor a hand-rolled wrapper catches this by default.
- **Silent store-ownership mismatches.** Products, discounts, license keys, and subscription plans whose `store_id` doesn't match the store you scoped the run to. Stable codes: `PRODUCT_WRONG_STORE`, `DISCOUNT_STORE_MISMATCH`, `LICENSE_KEY_STORE_MISMATCH`, `PLAN_STORE_MISMATCH`.
- **Webhook subscribed to the wrong events.** Diff against a manifest of recommended events (order/subscription lifecycle, refunds) and newer-but-optional events the SDK doesn't ship.
- **Platform drift.** A weekly GitHub Action hashes the [Lemon Squeezy API changelog](https://docs.lemonsqueezy.com/api/getting-started/changelog) against `src/support/changelog-snapshot.json`, refreshes docs-derived API types, and opens follow-up work when policy decisions are needed. Tracked additions include `customer_updated` (2026-02-25), `payment_processor` on Subscription (2025-06-11), Affiliates + `affiliate_activated` (2025-01-21), order item `quantity` (2024-12-06), checkout styling / `skip_trial` / `variant_quantities`, subscription invoice refund fields, and `test_mode` on `/v1/users/me` (2024-01-05).
- **Postman + dashboard ping-pong.** One `doctor` call replaces the loop of copying IDs out of the UI, pasting them into env files, and verifying each one by hand.

## fresh-squeezy vs the alternatives

How a typical Lemon Squeezy pre-ship check compares across the tools a developer would otherwise reach for:

| Capability | fresh-squeezy | Official SDK | Postman | Hand-rolled wrapper |
|---|:---:|:---:|:---:|:---:|
| Mode / key mismatch detection (`MODE_MISMATCH`) | ✅ | ❌ | ❌ | ❌ |
| Store-ownership cross-checks | ✅ | ❌ | ❌ | ⚠️ manual |
| Webhook event-coverage diff | ✅ | ❌ | ⚠️ manual | ⚠️ manual |
| Discount / license-key / plan validation | ✅ | ❌ | ❌ | ⚠️ manual |
| Changelog-drift tracking | ✅ | ❌ | ❌ | ❌ |
| Stable, CI-ready exit codes + JSON | ✅ | ❌ | ❌ | ⚠️ manual |
| One-command full sweep (`doctor`) | ✅ | ❌ | ❌ | ❌ |
| Typed API responses | ✅ | ✅ | ❌ | ⚠️ depends |

fresh-squeezy is **not** a replacement for the official SDK — it's the pre-flight check you run *alongside* it. Use the SDK to make API calls; use fresh-squeezy to prove your setup is correct before those calls hit production.

## CLI

```bash
# First run: install as a dev dependency, then start guided setup
npx fresh-squeezy

# Guided setup only: reuse env values, pick a store, choose resource checks
npx fresh-squeezy init

# TTY: multi-select stores interactively, run doctor on each
npx fresh-squeezy doctor

# Full sweep across every reachable store and resource
npx fresh-squeezy doctor --all-stores --all-resources

# Machine-readable full sweep for CI
npx fresh-squeezy doctor --all-stores --all-resources --json

# Single validator, scoped to specific stores
npx fresh-squeezy validate webhook \
  --store-ids 12,34 \
  --webhook-url https://app.example.com/api/webhooks/lemon-squeezy
```

Stores resolve in this order for every store-scoped command: explicit `--store-ids`, then `--all-stores`, then an interactive multi-select on a TTY, then a connection-only run when there's no TTY and no flag (useful as a CI smoke check). `doctor` validates connection and store access plus any explicit resource flags; add `--all-resources` to discover and validate every supported resource in the selected store(s).

**→ Full command, flag, and store-resolution reference: [docs/cli-reference.md](./docs/cli-reference.md)**

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

For multi-store runs at the library layer, call `doctor()` in a loop — the CLI does exactly this. Switch on `issue.code` in CI logic; codes are stable across minor versions.

Public types: [`FreshSqueezyClient`](src/createFreshSqueezy.ts), [`ValidationResult<T>`](src/core/types.ts), [`DoctorReport`](src/core/types.ts), resource attribute interfaces under [`src/resources`](src/resources), docs-generated Lemon Squeezy object types in [`src/generated/lemonSqueezyApiTypes.ts`](src/generated/lemonSqueezyApiTypes.ts), and changelog augmentation helpers in [`src/augmentations.ts`](src/augmentations.ts).

For endpoints not yet wrapped, use the raw escape hatch:

```ts
const user = await lemon.request({ path: "/v1/users/me" });
```

## Sandbox vs live

Lemon Squeezy serves both modes from the same API host; mode is determined by the key. `fresh-squeezy` cross-checks the declared mode against `meta.test_mode` from `/v1/users/me`. Mismatch = `MODE_MISMATCH`, doctor exits 1 — the fastest way to catch a prod key pointed at staging before it does damage.

```ts
const lemon = createFreshSqueezy({ mode: "test" });
const result = await lemon.validateConnection();
result.mode;                 // "test" (declared)
result.resource?.actualMode; // "live" — alarm bell
```

The CLI default is `--mode test`. Override with `--mode live`. Guided setup asks for explicit confirmation before continuing with a detected live-mode key. For nightly platform-drift checks in CI, run `npm run test:live` with `LEMON_SQUEEZY_LIVE_SMOKE=1` and a test-mode key.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `LEMON_SQUEEZY_API_KEY` | yes | Bearer token (library + CLI) |
| `LEMON_SQUEEZY_MODE` | no | `test` (default) or `live` |
| `LEMON_SQUEEZY_STORE_ID` | no | Convenience default for `client.doctor()` — library only |

The CLI does not read `LEMON_SQUEEZY_STORE_ID`; use `--store-ids` or `--all-stores` so store selection stays explicit per command.

## Issue codes

Switch on `issue.code` in CI — all codes are stable across minor versions. The most common ones:

| Code | Meaning |
|------|---------|
| `AUTH_FAILED` | Invalid or missing API key |
| `MODE_MISMATCH` | Declared mode doesn't match key's `meta.test_mode` |
| `STORE_NOT_FOUND` / `STORE_NOT_OWNED` | Store ID invalid or owned by another account |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | Product can't accept checkout |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING` | Webhook URL not registered or under-subscribed |

**→ Full issue-code reference (discounts, license keys, plans, variants, network) with escape-hatch examples: [docs/issue-codes.md](./docs/issue-codes.md)**

## Reference

Validators — each returns a stable `ValidationResult`:

- **`validateConnection`** — reachability, key validity, store presence, declared-vs-actual mode. [→ source](src/validate/connection.ts)
- **`validateStore`** — store ID exists and is owned by the key's account. [→ source](src/validate/store.ts)
- **`validateProduct`** — published, on the expected store, has live variants and a buy URL. [→ source](src/validate/product.ts)
- **`validateWebhook`** — webhook URL registered and subscribed to recommended events. [→ source](src/validate/webhook.ts)
- **`validateDiscount`** — active, in-window, valid amount, store ownership matches. [→ source](src/validate/discount.ts)
- **`validateLicenseKey`** — enabled, not expired, activations available, store ownership matches. [→ source](src/validate/licenseKey.ts)
- **`validateSubscriptionPlan`** — subscription type, valid interval, non-zero price, consistent trial. [→ source](src/validate/subscriptionPlan.ts)
- **`doctor`** — composes the above into one `DoctorReport`. [→ source](src/validate/doctor.ts)

Resource coverage is generated from Lemon Squeezy's object docs, so most newly documented fields don't need a hand edit:

```bash
npm run generate:api-types
npm run check:api-types
```

## FAQ

### How do I check if my Lemon Squeezy webhook is subscribed to the right events?

Run `npx fresh-squeezy validate webhook --store-ids <id> --webhook-url <url>`. fresh-squeezy diffs your webhook's subscribed events against a manifest of recommended order/subscription/refund events and reports `WEBHOOK_EVENTS_MISSING` for gaps, or `WEBHOOK_NOT_FOUND` if the URL isn't registered at all.

### How do I catch a Lemon Squeezy production key pointed at a test (staging) store?

That's the `MODE_MISMATCH` check. fresh-squeezy compares the mode you declared (`--mode` or `LEMON_SQUEEZY_MODE`) against the key's real `meta.test_mode` from `/v1/users/me`. When they disagree, `doctor` exits 1 — so a live key accidentally used in a staging deploy (or vice versa) fails the check before it reaches users.

### Does fresh-squeezy work in CI?

Yes. Run `npx fresh-squeezy doctor --all-stores --all-resources --json` for a machine-readable full sweep. It returns stable [exit codes](#30-second-start) (`0` pass, `1` validation errors, `2` fatal) and stable `issue.code` strings you can assert on. No TTY required — without store flags it falls back to a connection-only smoke check.

### Is fresh-squeezy a replacement for the official Lemon Squeezy SDK?

No. The [official SDK](https://github.com/lmsqueezy/lemonsqueezy.js) makes API calls; fresh-squeezy is the pre-flight check that proves your setup is correct *before* those calls hit production. They're complementary — see the [comparison table](#fresh-squeezy-vs-the-alternatives).

### What is "changelog drift" and why should I care?

Lemon Squeezy ships API changes (new events, new fields, new resources) faster than client SDKs adopt them. fresh-squeezy tracks the [official changelog](https://docs.lemonsqueezy.com/api/getting-started/changelog) against a committed snapshot via a weekly GitHub Action, so newly recommended webhook events or response fields surface as actionable work instead of silently going unvalidated.

### Can I use fresh-squeezy as a library instead of the CLI?

Yes. `import { createFreshSqueezy } from "fresh-squeezy"` and call `doctor()` or any individual validator. Every validator returns a typed, stable `ValidationResult` you can branch on — see [Library](#library).

### Which Lemon Squeezy resources can it validate?

Connection/auth, stores, products (and variants), webhooks, discounts, license keys, and subscription plans. Add `--all-resources` to discover and validate every supported resource in the selected store(s). Full list in the [reference](#reference).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Clone, `npm install`, `npm test`. The project aims to stay small and boring — validator-first, one HTTP layer, stable `issue.code` contract.

## Contributors

<a href="https://github.com/YosefHayim/fresh-squeezy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YosefHayim/fresh-squeezy" alt="fresh-squeezy contributors" />
</a>

## License

MIT — see [LICENSE](./LICENSE).
