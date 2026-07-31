---
name: fresh-squeezy-ops
description: >
  Use the fresh-squeezy CLI and TypeScript library for Lemon Squeezy: doctor/validate
  pre-flight checks plus docs-backed resource ops (get/list/create/update/delete/cancel/
  refund/generate-invoice/current-usage). Trigger when integrating Lemon Squeezy, running
  billing health checks, inspecting or changing Lemon Squeezy data, managing webhooks/
  discounts/checkouts/customers/subscriptions, or extending fresh-squeezy with a new
  resource verb. Prefer it over ad-hoc curl for supported store operations.
---

# fresh-squeezy ops + doctor

## What this package is

- **Doctor / validate** — pre-flight health for a Lemon Squeezy integration (mode, store ownership, webhooks, discounts, license keys, plans).
- **Ops** — dual-mode CLI + nested library client for **only** operations documented at [docs.lemonsqueezy.com/api](https://docs.lemonsqueezy.com/api).

**Not an app-embedding SDK.** Prefer `@lemonsqueezy/lemonsqueezy.js` inside product code; use fresh-squeezy for setup, CI gates, and store ops.

## Critical API honesty

Lemon Squeezy does **not** expose create/update/delete for catalog objects:

| Read-only in API | Writes / actions documented |
|------------------|-----------------------------|
| products, variants, prices, files, stores, affiliates, order-items, discount-redemptions, license-key-instances | webhooks CRUD; discounts create/delete; customers create/update; checkouts create; subscriptions update/cancel; subscription-items update + current-usage; usage-records create; license-keys update; orders refund + generate-invoice; subscription-invoices refund + generate-invoice |

Never invent `create product`. Confirm with `fresh-squeezy ops --list`.

Do not reverse-engineer private dashboard endpoints or claim catalog writes are supported.
When the user needs to create or change a product, variant, or price, direct them to the Lemon
Squeezy dashboard and use fresh-squeezy afterward to read and verify the resulting catalog.

## CLI dual-mode contract

| Context | Behavior |
|---------|----------|
| TTY bare `fresh-squeezy` | Launcher menu (never hang without TTY → exit 2) |
| Flags / CI / agents | No prompts; missing args → exit 2 |
| Exit codes | `0` ok · `1` validation failed · `2` fatal/usage · `130` cancel |

### Safety

- **delete / cancel / refund** → always need `--yes` or TTY confirm.
- **live mode** → any mutate needs `--yes` or TTY confirm.
- **test mode** create/update → free when args complete.

## CLI flow examples

```bash
# Matrix of implemented ops
fresh-squeezy ops --list
fresh-squeezy ops --list --json

# Health
export LEMON_SQUEEZY_API_KEY=…
export LEMON_SQUEEZY_MODE=test
fresh-squeezy doctor --all-stores --all-resources --json
fresh-squeezy validate connection --json

# Reads
fresh-squeezy get product --id 42 --json
fresh-squeezy list product --store-ids 1 --json
fresh-squeezy list variant --parent-id 42 --json
fresh-squeezy list webhook --store-ids 1

# Writes (test mode)
fresh-squeezy create webhook --body-file ./webhook.json --mode test
fresh-squeezy create discount --body-file ./discount.json --mode test
fresh-squeezy create checkout --body-file ./checkout.json --mode test
fresh-squeezy create customer --body-file ./customer.json --mode test

# Destructive / live — require --yes when non-TTY
fresh-squeezy delete webhook --id 12 --yes
fresh-squeezy cancel subscription --id 9 --yes --mode live
fresh-squeezy refund order --id 100 --yes --mode live
fresh-squeezy generate-invoice order --id 100 --yes
fresh-squeezy current-usage subscription-item --id 3 --json
```

### JSON:API body shape (matches official curl examples)

```json
{
  "data": {
    "type": "webhooks",
    "attributes": {
      "url": "https://app.example.com/api/webhooks/lemon-squeezy",
      "events": ["order_created", "subscription_created"],
      "secret": "whsec_…"
    },
    "relationships": {
      "store": { "data": { "type": "stores", "id": "1" } }
    }
  }
}
```

## Library usage

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const lemon = createFreshSqueezy(); // env: LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_MODE

// Doctor
const report = await lemon.doctor({ storeId: 1 });
if (!report.ok) process.exit(1);

// Nested ops (docs-backed only)
const product = await lemon.products.get(42);
const webhooks = await lemon.webhooks.list(1);
const created = await lemon.webhooks.create({
  data: {
    type: "webhooks",
    attributes: { url: "https://…", events: ["order_created"] },
    relationships: { store: { data: { type: "stores", id: "1" } } },
  },
});
await lemon.subscriptions.cancel(9);
```

HTTP failures throw `FreshSqueezyError` (`code` / `status`). Validators return `ValidationResult` and never throw for findings.

## Extending — golden path (resource verb)

1. Confirm the verb exists on official docs (`docsPath`).
2. Add `const createX = async (…) =>` / `updateX` / … in `src/resources/<name>.ts` via `HttpClient` only (const arrows — never `async function`).
3. Full TSDoc: why + `@param` + `@returns` + `@example` + `@throws` when applicable.
4. Register in `src/resources/registry.ts`.
5. Wire `invokeOp` switch + nested client in `createFreshSqueezy.ts`.
6. CLI already routes all `OpVerb`s; no main.ts change unless new verb token.
7. Tests: registry + invoke path; mockFetch / fake HttpClient.
8. Single named return type — no `{ a, b }` multi-entity bags.
9. Run `pnpm verify`.

### Adding a validator (separate recipe)

See `CODE-STYLE.md` → “How to add a validator”. Ops do not replace doctor.

## Key files

| Path | Role |
|------|------|
| `src/resources/registry.ts` | Implemented ops matrix + `docsPath` |
| `src/resources/invokeOp.ts` | Dispatcher |
| `src/resources/*.ts` | Thin HTTP helpers |
| `src/core/http.ts` | Only `fetch` |
| `src/cli/commands/resourceOps.ts` | CLI safety + body + exit codes |
| `src/cli/main.ts` | `get\|list\|create\|…` commands |
| `src/validate/*` | Doctor validators |
| `docs/cli-reference.md` | Human CLI reference |

## Agent checklist

- [ ] Prefer `ops --list` before assuming a write exists
- [ ] Never prompt in non-TTY; pass `--yes` for live/destructive
- [ ] Bodies are JSON:API documents, not flat flags
- [ ] Use doctor after setup changes when possible
- [ ] Mode-aware: test key vs live key (`MODE_MISMATCH` on doctor)
