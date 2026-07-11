# PROJECT.md

Purpose and direction for fresh-squeezy. What it is and how it's built live in
`CONTEXT.md` / `CODE-STYLE.md`; this file is the _why_ and the _where next_.

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
   verbs (throw `FreshSqueezyError`) — never silent passthroughs and never invented catalog
   writes (products/variants/prices have no create API).
2. **One HTTP layer.** Everything goes through `src/core/http.ts` for auth, error
   normalization, and retry.
3. **Stable contract.** `ValidationResult` shape and `issue.code` strings are public API;
   breaking either requires a major version bump.
4. **Mode-awareness everywhere.** Every validator surfaces `mode`; live writes and
   destructive ops require `--yes` or TTY confirm.
5. **Static support / ops registry + drift snapshot.** No live changelog scraping in
   runtime code. CI scrape may *propose* matrix gaps; only registered exports ship.

## Success criteria

- A misconfigured setup exits non-zero with a specific, stable `issue.code`.
- A correct setup exits `0` with no false positives.
- `--json` output is stable enough for CI to switch on without scraping prose.
- Adding a validator follows the recipe in `CODE-STYLE.md` without touching the transport
  or the result shape.

## Direction

Near-term: honor the interactive front door (bare → action menu, ADR-0003); tighten
internal purity (layer direction + pure `check*()` extraction, ADR-0004); adopt Biome
(ADR-0001) and the leaner dependency set (ADR-0002). Ongoing: keep coverage of the Lemon
Squeezy surface current via the drift workflow and the generated API types.

> Note: `CONTRIBUTING.md` references a `plan.md` and `docs/MANUAL_QA.md` that do not exist;
> this file is the real home for the non-goals, and those stale references should be fixed.
