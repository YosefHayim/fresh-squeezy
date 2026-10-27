# PROJECT.md — fresh-squeezy

Purpose and direction: why this exists and where it is going. What it is and how it fits
live in `CONTEXT.md`.

## The problem

A production key pointed at a test store, an unpublished product behind a live buy
button, a webhook missing the events fulfillment needs: Lemon Squeezy setup mistakes fail
silently in production.

## Who it's for

- Developers integrating Lemon Squeezy who want a check before release.
- CI pipelines that gate a deploy on a machine-readable billing report.
- Library users who embed single validators and switch on `issue.code`.

## The core insight

Each mistake becomes a stable issue code and a stable exit code, so one `doctor` run,
locally or in CI, says exactly what is wrong.

## Goals

- A broken setup exits non-zero with a specific, stable `issue.code`.
- A correct setup exits `0` with no false positives.
- `--json` output is stable enough for CI to switch on without reading prose.
- A new validator needs no change to the HTTP layer or the result shape.

## Non-goals

- Not an SDK to embed in apps: use `@lemonsqueezy/lemonsqueezy.js` there.
- No invented catalog writes: products, variants and prices have no create API.
- No live changelog scraping at runtime.

## Direction

- **Built:** the doctor and its 7 validators, docs-backed ops with write safety, the launcher menu, changelog drift, SDK augmentations.
- **Next:** the code-standard 0.3.0 cleanup; cut CI waste (#31).

## Guiding principles

1. **Validator first.** No passthroughs that hide HTTP calls; a write is an explicit resource verb.
2. **One HTTP layer.** Auth, error mapping and retry live in one place.
3. **Stable contract.** `ValidationResult` and issue codes are public API; breaking one is a major bump.
4. **Mode everywhere.** Every result names its mode; live and destructive writes need `--yes` or a TTY confirm.
5. **Static registry.** Only registered, docs-backed verbs ship; the drift job only proposes.
