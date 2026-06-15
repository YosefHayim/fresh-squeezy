# CLI reference

Full command, flag, and store-resolution reference for the `fresh-squeezy` CLI. For a quick overview, see the [README](../README.md#cli).

## Commands

```bash
# First run: install as a dev dependency, then start guided setup
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
```

`npx fresh-squeezy --no-install` runs the setup without editing `package.json`.

## Command summary

| Command | What it does | Source |
|---------|--------------|--------|
| `doctor` | Run configured validators; add `--all-resources` for discovery-backed full sweeps | [src/cli/commands/doctor.ts](../src/cli/commands/doctor.ts) |
| `validate <name>` | Run a single validator | [src/cli/commands/validate.ts](../src/cli/commands/validate.ts) |
| `init` | Interactive setup: ask for credentials, pick a store, run doctor | [src/cli/commands/init.ts](../src/cli/commands/init.ts) |
| `types augment` | Emit a local `.d.ts` for changelog fields not present in older SDK/local types | [src/cli/commands/augment.ts](../src/cli/commands/augment.ts) |

## Store resolution order

Used by every store-scoped command, in priority order:

1. `--store-ids 1,2,3` (comma-separated, explicit)
2. `--all-stores` (every store reachable with the key)
3. TTY: inquirer multi-select prompt
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
