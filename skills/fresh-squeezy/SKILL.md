---
name: fresh-squeezy
description: >
  Use fresh-squeezy for Lemon Squeezy: run the doctor to check a store before it ships,
  and call the typed TypeScript client to read or change Lemon Squeezy data (it replaces
  @lemonsqueezy/lemonsqueezy.js). Trigger when integrating Lemon Squeezy, checking a
  billing setup or CI gate, reading or changing stores, products, orders, subscriptions,
  discounts, webhooks, checkouts or license keys, or fixing a doctor finding.
---

# fresh-squeezy

## When to use it

- Before a release or deploy: check the store with the doctor.
- Any code that calls the Lemon Squeezy API: use the client, not curl and not `@lemonsqueezy/lemonsqueezy.js`.
- A user pastes a doctor finding or a failing CI run: read it and apply the fix.

## Run the doctor

```bash
npx fresh-squeezy doctor --all-resources --json
npx fresh-squeezy doctor --store-id 12 --all-resources --json
```

- Read `{ ok, mode, reports }`. Each report holds `checks`; each check holds `findings`.
- Exit code: `0` every check passed, `1` a check failed, `2` wrong flags or setup (missing key, bad mode).
- Read each finding's `code`, `message` and `suggestedFix`. Act on the fix, then run the doctor again until `ok` is `true`.
- Flags: `--mode <test|live>`, `--store-id <id>` (repeat), `--all-resources`, `--product-id`, `--variant-id`, `--webhook-url`, `--discount-id`, `--license-key-id` (each repeatable), `--json`. With no store flag it uses `LEMON_SQUEEZY_STORE_ID`, else every store.
- The doctor only reads. It never changes the store.

## Use the client

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const freshSqueezy = createFreshSqueezy(); // reads LEMON_SQUEEZY_MODE and the API key of that mode

const subscription = await freshSqueezy.get("subscriptions", "123");
const paidOrders = await freshSqueezy.list("orders", {
	store_id: 1,
	status: "paid",
});

await freshSqueezy.create("checkouts", {
	attributes: { checkout_data: { email: "ada@example.com" } },
	relationships: { store: "1", variant: "2" },
});
await freshSqueezy.update("subscriptions", "123", { pause: { mode: "void" } });
await freshSqueezy.remove("webhooks", "9");
await freshSqueezy.cancelSubscription("123");
await freshSqueezy.refund("orders", "55", 500);
await freshSqueezy.currentUsage("77");
```

- The resource name picks the types. Attribute names are snake_case, as the API sends them.
- `list` returns every page. Filters become `filter[...]` query params.
- A failed call throws a `FreshSqueezyError`. Check it with `isFreshSqueezyError` from `fresh-squeezy/errors` and branch on `.code`.
- The client only has the calls the Lemon Squeezy docs list (docs.lemonsqueezy.com/api). Products, variants and prices have no write API: tell the user to use the dashboard.

## License API

It needs no API key.

```ts
import {
	activateLicense,
	validateLicense,
	deactivateLicense,
} from "fresh-squeezy/license";

await activateLicense({ licenseKey, instanceName });
await validateLicense({ licenseKey, instanceId });
await deactivateLicense({ licenseKey, instanceId });
```

Each call returns the API answer, also on a 4xx: check `activated`, `valid` or `deactivated`, and `error`. It throws a `FreshSqueezyError` only when the network fails or the answer is not JSON.

## Safety

- Ask the user for a clear yes before any `create`, `update`, `remove`, `cancelSubscription`, `refund` or `generateInvoice` in live mode. In test mode, say what you will change, then do it.
- Check the mode first (`LEMON_SQUEEZY_MODE`, default `test`). Never switch to live on your own.
- Never print, log or commit the API key. Redact `apiKey` in any report you share.
- Do not invent endpoints or reverse-engineer the dashboard.
