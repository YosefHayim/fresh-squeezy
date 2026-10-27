# PROJECT.md

Purpose and direction for fresh-squeezy. What it is and how it's built live in
`CONTEXT.md` / `AGENTS.md`; this file is the _why_ and the _where next_.

## Purpose

Catch Lemon Squeezy billing misconfigurations before they ship. A production key pointed
at a test store, an unpublished product behind a live buy button, a webhook missing the
events your fulfillment depends on — these fail silently in production. fresh-squeezy turns
them into a one-command `doctor` run with stable exit codes, locally and in CI.

## Who it's for

- Developers integrating Lemon Squeezy who want a pre-flight check before release.
- CI pipelines gating a deploy on a machine-readable billing health report.
- Library consumers embedding specific validators and switching on `issue.code`.

## Scope

In scope: pre-flight validation (stores, products, webhooks, discounts, license keys,
subscription plans, mode); `doctor` composition; **docs-backed resource ops** (get/list
plus create/update/delete/cancel/refund/generate-invoice/current-usage where the official
API allows); dual-mode CLI; changelog-drift tracking; `.d.ts` augmentations for SDK users.

## Non-goals

These are held as firmly as the goals:

1. **Not an app-embedding SDK.** Prefer `@lemonsqueezy/lemonsqueezy.js` inside apps.
   fresh-squeezy is dual-mode **ops + doctor**. Mutations are explicit, docs-backed resource
   verbs (throw via `freshSqueezyErrorOf`) — never silent passthroughs and never invented catalog
   writes (products/variants/prices have no create API).
2. **One HTTP layer.** Everything goes through `src/http/http.ts` for auth, error
   normalization, and retry.
3. **Stable contract.** `ValidationResult` shape and `issue.code` strings are public API;
   breaking either requires a major version bump.
4. **Mode-awareness everywhere.** Every validator surfaces `mode`; live writes and
   destructive ops require `--yes` or TTY confirm.
5. **Static support / ops registry + drift snapshot.** No live changelog scraping in
   runtime code. CI scrape may _propose_ matrix gaps; only registered exports ship.

## Success criteria

- A misconfigured setup exits non-zero with a specific, stable `issue.code`.
- A correct setup exits `0` with no false positives.
- `--json` output is stable enough for CI to switch on without scraping prose.
- Adding a validator follows the recipe in `CONTEXT.md` without touching the transport
  or the result shape.

## Direction

Near-term: honor the interactive front door (bare → action menu); tighten
internal purity (layer direction + pure `check*()` extraction); adopt Biome
and the leaner dependency set. Ongoing: keep coverage of the Lemon
Squeezy surface current via the drift workflow and the generated API types.

## Releasing

Releases are automatic. When a PR merges into `main`, the `Release` workflow bumps `package.json`, tags the commit and creates the GitHub release, then `Publish Package` publishes to npm.

- The bump is a patch by default. Add the `minor` or `major` label to the PR to change it.
- Add the `no-release` label to skip the release.
- If `src/support/manifest.ts` changed, refresh the snapshot with `pnpm check:changelog -- --update` in the same PR.

## Changelog drift

The weekly `changelog-drift` workflow (Monday 06:00 UTC) opens an issue when the Lemon Squeezy changelog moves. It is advisory and never edits code.

1. Read the "New entries" section of the issue: each entry has a date, heading and body excerpt.
2. Decide per entry: codify as a check, acknowledge as out of scope, or skip if cosmetic.
3. To codify or acknowledge, add a row to `ACKNOWLEDGED_CHANGELOG_ENTRIES` in `src/support/manifest.ts` (date, one-line summary, action taken). When codifying, also wire the check in `src/validate/`.
4. Refresh the snapshot so future runs start from the new baseline: `pnpm check:changelog -- --update`.
5. Open a PR titled `chore(changelog): adopt YYYY-MM-DD entries` with both `src/support/manifest.ts` and `src/support/changelog-snapshot.json`, and close the drift issue from it (`Closes #123`).

A nightly CI run smokes the live API with a test-mode key. Before a release, smoke the CLI by hand against a test-mode key: `npx fresh-squeezy` and `fresh-squeezy doctor --all-stores`.
