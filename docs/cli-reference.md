# CLI reference

Full command, flag, and store-resolution reference for the `fresh-squeezy` CLI. For a quick overview, see the [README](../README.md#cli).

## Commands

```bash
# First run: install as a dev dependency, then open the interactive front door
# (no key configured yet → jumps straight to guided setup)
npx fresh-squeezy

# Guided setup only: reuse env values, pick a store, choose one or more resource checks
npx fresh-squeezy init

# TTY: multi-select stores interactively, run doctor on each
npx fresh-squeezy doctor

# Non-interactive: every reachable store
npx fresh-squeezy doctor --all-stores

# Full sweep: discover products, webhooks, discounts, license keys, and subscription plans
npx fresh-squeezy doctor --all-stores --all-resources

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

# Machine-readable full sweep for CI
npx fresh-squeezy doctor --all-stores --all-resources --json

# Emit a local .d.ts for changelog fields not present in older SDK/local types
npx fresh-squeezy types augment

# Docs-backed ops matrix (products/variants are read-only on the real API)
npx fresh-squeezy ops --list
npx fresh-squeezy ops --list --json

# Resource ops (get/list/create/update/delete/cancel/refund/generate-invoice/current-usage)
npx fresh-squeezy get product --id 42 --json
npx fresh-squeezy list webhook --store-ids 12
npx fresh-squeezy create webhook --body-file webhook.json --mode test
npx fresh-squeezy cancel subscription --id 9 --yes
npx fresh-squeezy refund order --id 100 --yes --mode live
```

`npx fresh-squeezy --no-install` runs the setup without editing `package.json`.

## Interactive front door

A bare `fresh-squeezy` in a TTY first ensures the package is a dev dependency, then:

- **No API key configured** → jumps straight to guided setup (`init`).
- **API key present** → opens an action menu that routes to the same handlers as the flags: guided setup, `doctor` (with interactive store selection), copy/paste command examples, or exit.

Flags and non-interactive shells never open the menu — they defer (`doctor` falls back to a connection-only run) or exit `2`, so nothing hangs in CI.

## Command summary

| Command | What it does | Source |
|---------|--------------|--------|
| `doctor` | Run configured validators; add `--all-resources` for discovery-backed full sweeps | [src/cli/commands/doctor.ts](../src/cli/commands/doctor.ts) |
| `validate <name>` | Run a single validator | [src/cli/commands/validate.ts](../src/cli/commands/validate.ts) |
| `init` | Interactive setup: ask for credentials, pick a store, run doctor | [src/cli/commands/init.ts](../src/cli/commands/init.ts) |
| `types augment` | Emit a local `.d.ts` for changelog fields not present in older SDK/local types | [src/cli/commands/augment.ts](../src/cli/commands/augment.ts) |
| `ops --list` | Print the docs-backed verb × resource matrix | [src/cli/commands/resourceOps.ts](../src/cli/commands/resourceOps.ts) |
| `get\|list\|create\|update\|delete\|cancel\|refund\|generate-invoice\|current-usage <resource>` | Docs-backed resource ops (JSON:API body via `--body` / `--body-file`) | [src/cli/commands/resourceOps.ts](../src/cli/commands/resourceOps.ts) |

## Ops safety

| Rule | Behavior |
|------|----------|
| `delete` / `cancel` / `refund` | Always require `--yes` or TTY confirm |
| Live-mode writes | Require `--yes` or TTY confirm |
| Test-mode create/update | Free when args are complete |
| Non-TTY missing args | Exit `2` — never hang |

Confirm the matrix with `fresh-squeezy ops --list` before assuming a write exists (products/variants/prices/files/stores are read-only on the official API).

## Store resolution order

Used by every store-scoped command, in priority order:

1. `--store-ids 1,2,3` (comma-separated, explicit)
2. `--all-stores` (every store reachable with the key)
3. TTY: interactive multi-select prompt (`@inquirer/prompts`)
4. No TTY + no flag: connection-only run (useful as a CI smoke check)

By default, `doctor` validates connection and store access plus any explicit resource flags you pass. Add `--all-resources` when you want the CLI to discover and validate every supported resource in the selected store(s).

## Mode flag

The CLI default is `--mode test`. Override with `--mode live`. Guided setup asks for explicit confirmation before continuing with a detected live-mode key. fresh-squeezy cross-checks the declared mode against `meta.test_mode` from `/v1/users/me`; a mismatch raises `MODE_MISMATCH` and `doctor` exits 1.

## Keeping API types current

Resource coverage is generated from Lemon Squeezy's object docs, so most newly documented fields do not require a hand edit:

```bash
npm run generate:api-types
npm run check:api-types
```

Manual review still applies to validator behavior and webhook policy: new events belong in `RECOMMENDED_WEBHOOK_EVENTS` or `OPTIONAL_WEBHOOK_EVENTS`, and meaningful platform changes should be acknowledged in `ACKNOWLEDGED_CHANGELOG_ENTRIES`.
