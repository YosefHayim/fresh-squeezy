# Manual QA checklist

Run through these steps before each release. Pair them with the automated test suites — manual QA catches UX regressions the unit tests can't.

## Prerequisites

- A Lemon Squeezy account with at least one **test-mode** store
- A published **test-mode** product with at least one published variant
- A webhook registered against a URL you control (ngrok works: `ngrok http 3000`)
- `.env.local` populated from `.env.example`:
  ```
  LEMON_SQUEEZY_API_KEY=eyJ0eXAi...    # test-mode key
  LEMON_SQUEEZY_STORE_ID=42
  LEMON_SQUEEZY_MODE=test
  ```

## 1. Sandbox (test mode)

### 1.1 Library — happy path

```ts
// scratch.ts
import { createFreshSqueezy } from "fresh-squeezy";
const lemon = createFreshSqueezy();
console.log(await lemon.doctor({
  productId: <YOUR_PRODUCT_ID>,
  webhookUrl: "<YOUR_WEBHOOK_URL>",
}));
```

Run: `npx tsx scratch.ts`

**Expect**:
- `ok: true`
- `mode: "test"`
- 4 results: `connection`, `store`, `product`, `webhook`
- Zero `error`-severity issues

### 1.2 CLI — full doctor

```bash
npm run build
node bin/fresh-squeezy.js doctor \
  --product-id <YOUR_PRODUCT_ID> \
  --webhook-url <YOUR_WEBHOOK_URL>
```

**Expect**: exit code `0`, colored output with four `PASS [test]` lines.

### 1.3 CLI — JSON mode

```bash
node bin/fresh-squeezy.js doctor --json | jq .
```

**Expect**: valid JSON, `ok: true`, results array.

### 1.4 Interactive init

```bash
node bin/fresh-squeezy.js init
```

**Expect**:
- Password prompt for API key (characters masked with `*`)
- Mode selector (test / live)
- Store picker listing reachable stores
- Confirmation before writing `.env.local`
- Final doctor report printed

Delete `.env.local` and re-run — it should re-prompt.

### 1.5 Single validator commands

```bash
node bin/fresh-squeezy.js validate connection
node bin/fresh-squeezy.js validate store --store-id <ID>
node bin/fresh-squeezy.js validate product --product-id <ID> --store-id <ID>
node bin/fresh-squeezy.js validate webhook --store-id <ID> --url <URL>
```

**Expect**: each exits `0`, each prints its own `PASS [test]` line.

## 2. Failure cases (the checks that actually matter)

### 2.1 Bad API key

```bash
LEMON_SQUEEZY_API_KEY=not-a-real-key node bin/fresh-squeezy.js doctor
```

**Expect**:
- Exit code `1`
- `FAIL [test] connection` with issue code `AUTH_FAILED`
- Doctor stops after connection — store/product/webhook do not run

### 2.2 Unpublished product

Draft a product in the Lemon Squeezy dashboard, then:

```bash
node bin/fresh-squeezy.js validate product --product-id <DRAFT_ID>
```

**Expect**: `FAIL` with `PRODUCT_UNPUBLISHED`.

### 2.3 Product on wrong store

```bash
node bin/fresh-squeezy.js validate product --product-id <ID_FROM_STORE_A> --store-id <STORE_B>
```

**Expect**: `FAIL` with `PRODUCT_WRONG_STORE`.

### 2.4 Webhook missing events

In the dashboard, remove `subscription_cancelled` from a webhook, then:

```bash
node bin/fresh-squeezy.js validate webhook --store-id <ID> --url <URL>
```

**Expect**: `FAIL` with `WEBHOOK_EVENTS_MISSING` listing `subscription_cancelled`.

### 2.5 Webhook URL not found

```bash
node bin/fresh-squeezy.js validate webhook --store-id <ID> --url https://nope.example.com
```

**Expect**: `FAIL` with `WEBHOOK_NOT_FOUND`.

### 2.6 Mode mismatch

Set a live key but run with `--mode test`:

```bash
LEMON_SQUEEZY_API_KEY=<LIVE_KEY> node bin/fresh-squeezy.js doctor --mode test
```

**Expect**: the `mode` field on the result reflects the configured mode. Live keys will still authenticate — the point of surfacing `mode` is so your CI can compare it against what the caller expected.

## 3. Live mode

Only run against a sacrificial store with no real customers.

```bash
LEMON_SQUEEZY_API_KEY=<LIVE_KEY> \
LEMON_SQUEEZY_STORE_ID=<LIVE_STORE_ID> \
node bin/fresh-squeezy.js doctor --mode live
```

**Expect**: all results have `mode: "live"`. Treat a failure here as a production incident, not a test failure.

## 4. Regression checks

Before releasing, confirm:

- [ ] `npm run typecheck` clean
- [ ] `npm run test` green
- [ ] `npm run test:coverage` stays above thresholds (80/80/75/80)
- [ ] `npm run build` produces `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/cli.js`
- [ ] `bin/fresh-squeezy.js --help` prints commander help with every subcommand
- [ ] `bin/fresh-squeezy.js --version` matches `package.json`
- [ ] `src/support/manifest.ts` reflects the latest Lemon Squeezy changelog entries

## 5. After release

- Tag pushed
- npm publish succeeded (check the `release` workflow)
- Install in a scratch repo and verify:
  ```bash
  mkdir /tmp/fs-smoke && cd /tmp/fs-smoke
  npm init -y && npm install fresh-squeezy
  npx fresh-squeezy --version
  ```
