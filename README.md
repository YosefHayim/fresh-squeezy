<!-- Canonical README. Translations (README.zh-CN.md, README.ja.md, README.es.md, README.pt-BR.md) are derived from this file; English is the source of truth. -->

<p align="center">
  <a href="https://github.com/YosefHayim/fresh-squeezy">
    <img src="public/fresh-squeezy-hero.png" alt="fresh-squeezy — the up-to-date Lemon Squeezy client, plus a doctor that checks your billing setup." width="640" />
  </a>
</p>

<p align="center">
  <strong>The up-to-date Lemon Squeezy client for TypeScript, plus a doctor that catches billing misconfigurations before they ship.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/v/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/dm/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm downloads per month" /></a>
  <a href="https://github.com/YosefHayim/fresh-squeezy/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/YosefHayim/fresh-squeezy/ci.yml?branch=main&amp;logo=github&amp;label=CI" alt="CI status" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/fresh-squeezy?color=3fb950" alt="MIT license" /></a>
  <img src="https://img.shields.io/node/v/fresh-squeezy?logo=node.js&amp;logoColor=white&amp;color=339933" alt="Node.js 22 or newer" />
  <img src="https://img.shields.io/npm/types/fresh-squeezy?logo=typescript&amp;logoColor=white" alt="TypeScript types included" />
  <a href="https://packagephobia.com/result?p=fresh-squeezy"><img src="https://packagephobia.com/badge?p=fresh-squeezy" alt="install size" /></a>
</p>

<p align="center">
  <b>English</b> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.pt-BR.md">Português</a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#client">Client</a> ·
  <a href="#doctor">Doctor</a> ·
  <a href="#replacing-lemonsqueezylemonsqueezyjs">Replacing the SDK</a> ·
  <a href="#upgrading-from-03">Upgrading from 0.3</a> ·
  <a href="#keeping-types-current">Keeping types current</a> ·
  <a href="#finding-codes">Finding codes</a>
</p>

---

**fresh-squeezy** is two things for [Lemon Squeezy](https://www.lemonsqueezy.com/):

1. **A typed client** that replaces [`@lemonsqueezy/lemonsqueezy.js`](https://github.com/lmsqueezy/lemonsqueezy.js). The official SDK last shipped 4.0.0 on 2024-11-05; fresh-squeezy follows the [API changelog](https://docs.lemonsqueezy.com/api/getting-started/changelog). Zero runtime dependencies, ESM and CJS.
2. **A doctor** that checks a store before it ships: connection and mode, store, products, subscription plans, webhooks, discounts and license keys. It gives stable finding codes, stable exit codes and JSON for CI.

Node 22 or newer.

## Install

```bash
pnpm add fresh-squeezy
```

Set the key once. Mode defaults to `test`.

```bash
LEMON_SQUEEZY_API_KEY=your-key
LEMON_SQUEEZY_MODE=test
LEMON_SQUEEZY_STORE_ID=12
```

`LEMON_SQUEEZY_STORE_ID` is optional. The same names work as `createFreshSqueezy({ apiKey, mode, storeId, baseUrl })` options.

## Client

The resource name picks the types. Attribute names are snake_case, as the API sends them.

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const freshSqueezy = createFreshSqueezy();

const subscription = await freshSqueezy.get("subscriptions", "123");
const paidOrders = await freshSqueezy.list("orders", { store_id: 1, status: "paid" });

await freshSqueezy.create("checkouts", {
	attributes: { checkout_data: { email: "ada@example.com" } },
	relationships: { store: "1", variant: "2" },
});
await freshSqueezy.update("subscriptions", "123", { pause: { mode: "void" } });
await freshSqueezy.remove("webhooks", "9");
await freshSqueezy.cancelSubscription("123");
await freshSqueezy.refund("orders", "55", 500);
await freshSqueezy.generateInvoice("orders", "55", { name, address, city, state, zip_code, country });
await freshSqueezy.currentUsage("77");
```

- `list` reads every page. Filters become `filter[...]` query params.
- A failed call throws a `FreshSqueezyError` (a plain `Error` with `code`, `status` and `detail`). Check it with `isFreshSqueezyError` from `fresh-squeezy/errors` and branch on `.code`.
- The client has only the calls the [Lemon Squeezy API docs](https://docs.lemonsqueezy.com/api) list. Products, variants and prices have no write API, so there is no write here.

The license API needs no API key and lives on its own subpath:

```ts
import { activateLicense, validateLicense, deactivateLicense } from "fresh-squeezy/license";

await activateLicense({ licenseKey, instanceName });
await validateLicense({ licenseKey, instanceId }); // instanceId is optional
await deactivateLicense({ licenseKey, instanceId });
```

## Doctor

```bash
# Every store the key can reach
npx fresh-squeezy doctor

# One store, plus every product, plan, webhook, discount and license key in it
npx fresh-squeezy doctor --store-id 12 --all-resources

# Two stores, one webhook URL, machine-readable
npx fresh-squeezy doctor --store-id 12 --store-id 34 \
  --webhook-url https://app.example.com/api/webhooks/lemon-squeezy --json
```

| Flag                    | Meaning                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `--mode <test\|live>`   | Mode to check. Default: `LEMON_SQUEEZY_MODE`, else `test`                            |
| `--store-id <id>`       | Store to check, repeat for more. Default: `LEMON_SQUEEZY_STORE_ID`, else every store |
| `--all-resources`       | Also check every product, plan, webhook, discount and license key in each store      |
| `--product-id <id>`     | Product to check, repeat for more                                                    |
| `--variant-id <id>`     | Subscription plan to check, repeat for more                                          |
| `--webhook-url <url>`   | Webhook to check, repeat for more                                                    |
| `--discount-id <id>`    | Discount to check, repeat for more                                                   |
| `--license-key-id <id>` | License key to check, repeat for more                                                |
| `--json`                | Print the reports as JSON                                                            |
| `--help`, `--version`   | Show the help or the version                                                         |

The doctor reads `LEMON_SQUEEZY_API_KEY` from the environment or from a `.env` file in the working directory. It never prompts and never hangs.

| Exit | Meaning                                                |
| ---- | ------------------------------------------------------ |
| `0`  | Every check passed                                     |
| `1`  | A check failed                                         |
| `2`  | Wrong flags or setup (missing key, bad mode, bad flag) |

`--json` prints one object:

```json
{
  "ok": false,
  "mode": "test",
  "reports": [
    {
      "ok": false,
      "mode": "test",
      "results": [
        {
          "name": "discount",
          "ok": false,
          "mode": "test",
          "target": { "label": "discount", "id": "77" },
          "findings": [
            {
              "code": "DISCOUNT_EXPIRED",
              "severity": "error",
              "message": "...",
              "suggestedFix": "..."
            }
          ]
        }
      ]
    }
  ]
}
```

`reports` holds one report per store. A check is `ok` when it has no `error` finding.

### CI

```yaml
- name: Check Lemon Squeezy
  run: npx fresh-squeezy doctor --all-resources --json
  env:
    LEMON_SQUEEZY_API_KEY: ${{ secrets.LEMON_SQUEEZY_API_KEY }}
    LEMON_SQUEEZY_MODE: live
```

The step fails on exit `1` or `2`. A live key pointed at a test store (or the reverse) raises `MODE_MISMATCH`: the doctor compares the declared mode with `meta.test_mode` from `/v1/users/me`.

### The checks from TypeScript

Each check returns a `ValidationResult` and never throws.

```ts
const freshSqueezy = createFreshSqueezy({ mode: "live" });

const connection = await freshSqueezy.validateConnection();
const discount = await freshSqueezy.validateDiscount({ storeId: "12", discountId: "77" });
const report = await freshSqueezy.doctor({ storeId: "12", allResources: true });
const storeIds = await freshSqueezy.listStoreIds();

for (const check of report.results) {
	for (const finding of check.findings) {
		console.error(`[${finding.severity}] ${finding.code}: ${finding.message}`);
	}
}
```

The checks: `validateConnection`, `validateStore`, `validateProduct`, `validateSubscriptionPlan`, `validateWebhook`, `validateDiscount`, `validateLicenseKey`, and `doctor`, which runs them for one store. Types for results and findings come from `fresh-squeezy/findings`.

## Replacing @lemonsqueezy/lemonsqueezy.js

Every function the SDK exports, and the fresh-squeezy call that replaces it. Differences that hold for all rows:

- `lemonSqueezySetup` becomes `createFreshSqueezy`. There is no global state: keep the object it returns.
- The SDK returns `{ statusCode, data, error }`. fresh-squeezy returns the resource and throws a `FreshSqueezyError` on failure.
- Attributes are snake_case (`variant_id`), not camelCase (`variantId`). Ids are strings.
- `archiveCustomer` is `update("customers", id, { status: "archived" })`, as the [update customer docs](https://docs.lemonsqueezy.com/api/customers/update-customer) describe.
- The license functions move to `fresh-squeezy/license`.

| `@lemonsqueezy/lemonsqueezy.js` | `fresh-squeezy` |
| ------------------------------- | --------------- |
| `activateLicense` | `activateLicense({ licenseKey, instanceName })` from `fresh-squeezy/license` |
| `archiveCustomer` | `update("customers", id, { status: "archived" })` |
| `cancelSubscription` | `cancelSubscription(id)` |
| `createCheckout` | `create("checkouts", { attributes, relationships: { store, variant } })` |
| `createCustomer` | `create("customers", { attributes, relationships: { store: storeId } })` |
| `createDiscount` | `create("discounts", { attributes, relationships: { store, variants } })` |
| `createUsageRecord` | `create("usage-records", { attributes, relationships: { "subscription-item": id } })` |
| `createWebhook` | `create("webhooks", { attributes, relationships: { store: storeId } })` |
| `deactivateLicense` | `deactivateLicense({ licenseKey, instanceId })` from `fresh-squeezy/license` |
| `deleteDiscount` | `remove("discounts", id)` |
| `deleteWebhook` | `remove("webhooks", id)` |
| `generateOrderInvoice` | `generateInvoice("orders", id, billing)` |
| `generateSubscriptionInvoice` | `generateInvoice("subscription-invoices", id, billing)` |
| `getAuthenticatedUser` | `get("users", "me")` |
| `getCheckout` | `get("checkouts", id)` |
| `getCustomer` | `get("customers", id)` |
| `getDiscount` | `get("discounts", id)` |
| `getDiscountRedemption` | `get("discount-redemptions", id)` |
| `getFile` | `get("files", id)` |
| `getLicenseKey` | `get("license-keys", id)` |
| `getLicenseKeyInstance` | `get("license-key-instances", id)` |
| `getOrder` | `get("orders", id)` |
| `getOrderItem` | `get("order-items", id)` |
| `getPrice` | `get("prices", id)` |
| `getProduct` | `get("products", id)` |
| `getStore` | `get("stores", id)` |
| `getSubscription` | `get("subscriptions", id)` |
| `getSubscriptionInvoice` | `get("subscription-invoices", id)` |
| `getSubscriptionItem` | `get("subscription-items", id)` |
| `getSubscriptionItemCurrentUsage` | `currentUsage(subscriptionItemId)` |
| `getUsageRecord` | `get("usage-records", id)` |
| `getVariant` | `get("variants", id)` |
| `getWebhook` | `get("webhooks", id)` |
| `issueOrderRefund` | `refund("orders", id, amount)` |
| `issueSubscriptionInvoiceRefund` | `refund("subscription-invoices", id, amount)` |
| `lemonSqueezySetup` | `createFreshSqueezy({ apiKey })` |
| `listCheckouts` | `list("checkouts", filter)` |
| `listCustomers` | `list("customers", filter)` |
| `listDiscountRedemptions` | `list("discount-redemptions", filter)` |
| `listDiscounts` | `list("discounts", filter)` |
| `listFiles` | `list("files", filter)` |
| `listLicenseKeyInstances` | `list("license-key-instances", filter)` |
| `listLicenseKeys` | `list("license-keys", filter)` |
| `listOrderItems` | `list("order-items", filter)` |
| `listOrders` | `list("orders", filter)` |
| `listPrices` | `list("prices", filter)` |
| `listProducts` | `list("products", filter)` |
| `listStores` | `list("stores", filter)` |
| `listSubscriptionInvoices` | `list("subscription-invoices", filter)` |
| `listSubscriptionItems` | `list("subscription-items", filter)` |
| `listSubscriptions` | `list("subscriptions", filter)` |
| `listUsageRecords` | `list("usage-records", filter)` |
| `listVariants` | `list("variants", filter)` |
| `listWebhooks` | `list("webhooks", filter)` |
| `updateCustomer` | `update("customers", id, attributes)` |
| `updateLicenseKey` | `update("license-keys", id, attributes)` |
| `updateSubscription` | `update("subscriptions", id, attributes)` |
| `updateSubscriptionItem` | `update("subscription-items", id, attributes)` |
| `updateWebhook` | `update("webhooks", id, attributes)` |
| `validateLicense` | `validateLicense({ licenseKey, instanceId })` from `fresh-squeezy/license` |

The 60 rows are every function exported by `@lemonsqueezy/lemonsqueezy.js` 4.0.0.

## Upgrading from 0.3

- The ops commands and the verb registry are gone. Use the [client](#client).
- `init`, `manage`, the `validate` subcommands, the augmentations and the launcher menu are gone. The only command is `fresh-squeezy doctor`, and it takes flags only.
- `--store-ids a,b` is now `--store-id a --store-id b`. With no store given, the doctor checks every store, so `--all-stores` is the default.
- Issues are findings: `ISSUE_CODES` is `FINDING_CODES`, `issue.code` is `finding.code`, and the JSON key `issues` is `findings`. The codes are unchanged, except `STORE_NOT_OWNED`, which is removed (nothing raised it).
- The subpath exports are now `.`, `./config`, `./errors`, `./findings`, `./types` and `./license`.
- Node 22 or newer. The runtime dependencies are gone.

```ts
// before
import { validateStore } from "fresh-squeezy/validate/store";
if (result.issues.length > 0) console.error(result.issues[0].code);

// after
import { createFreshSqueezy } from "fresh-squeezy";
const freshSqueezy = createFreshSqueezy();
const result = await freshSqueezy.validateStore("12");
if (result.findings.length > 0) console.error(result.findings[0].code);
```

## Keeping types current

The `lemon-squeezy-changelog` workflow runs on the 1st and 15th of each month. When the newest entry on the [API changelog](https://docs.lemonsqueezy.com/api/getting-started/changelog) has no issue yet, it opens one labeled `changelog-drift`.

To fix it, read the entry, then edit `src/shared/lemon-squeezy-types.ts` and the client by hand, add a test, and close the issue. An agent can take the issue.

GitHub turns scheduled workflows off after 60 days without repository activity in a public repo. Turn it back on with:

```bash
gh workflow enable lemon-squeezy-changelog
```

## Finding codes

Switch on `finding.code` in CI. Codes are stable across minor versions.

| Code                                                                 | Meaning                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| `AUTH_FAILED`                                                        | Invalid or missing API key                              |
| `MODE_MISMATCH`                                                      | Declared mode does not match the key's `meta.test_mode` |
| `STORE_NOT_FOUND`                                                    | Store ID not found for this key                         |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | Product cannot take a checkout                          |
| `PLAN_INVALID_INTERVAL` / `PLAN_FREE_PRICE`                          | Subscription plan has a bad interval or no price        |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING`                       | Webhook URL not registered or missing events            |
| `DISCOUNT_EXPIRED` / `DISCOUNT_REDEMPTIONS_EXHAUSTED`                | Discount cannot be used                                 |
| `LICENSE_KEY_DISABLED` / `LICENSE_KEY_EXPIRED`                       | License key cannot activate                             |

The full list is `FINDING_CODES` in `fresh-squeezy/findings`.

## Contributing

Requirements: Node.js 22+ and pnpm 10.

```bash
git clone https://github.com/YosefHayim/fresh-squeezy.git
cd fresh-squeezy
pnpm install
pnpm verify
```

Read [PROJECT.md](./PROJECT.md) for the goals and non-goals, [AGENTS.md](./AGENTS.md) for the commands, rules and recipes, and [CONTEXT.md](./CONTEXT.md) for the shape of the code.

When you file an issue, include the `fresh-squeezy` version, the Node version, the mode, a minimal reproduction and the doctor `--json` output with the key removed.

## Contributors

<a href="https://github.com/YosefHayim/fresh-squeezy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YosefHayim/fresh-squeezy" alt="fresh-squeezy contributors" />
</a>

## License

MIT — see [LICENSE](./LICENSE).
