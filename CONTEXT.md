# CONTEXT.md

Orientation for fresh-squeezy — what it is, who touches it, and the shape of the code. Not
a glossary (that's `LANGUAGE.md`) and not the rules (that's `CODE-STYLE.md`).

## What it is

A pre-flight validator for a Lemon Squeezy billing integration. It proves a setup is
correct — stores, products, webhooks, discounts, license keys, subscription plans, and
test-vs-live mode — before those calls reach production. It is **not** a replacement for
the official Lemon Squeezy SDK: use the SDK to make calls, use fresh-squeezy to catch
misconfigurations first. Ships as both a CLI (`npx fresh-squeezy`) and a TypeScript
library.

## Actors

- **Developer at a terminal** — runs `fresh-squeezy` interactively; a bare invocation opens
  a menu (doctor / validate / init / augment), prompts for a key and stores.
- **CI runner** — runs `fresh-squeezy doctor --all-stores --all-resources --json`; reads
  stable exit codes (0/1/2/130) and machine JSON. Never prompted (non-TTY defers).
- **Library consumer** — imports `createFreshSqueezy()` and calls validators directly,
  switching on `issue.code`.
- **The weekly drift workflow** — diffs the Lemon Squeezy changelog against a committed
  snapshot and opens an issue when upstream moves.

## Shape

Layer-based, strict one-directional imports (`generated → core → resources → validate →
cli`):

```
generated/        auto-generated Lemon Squeezy attribute types
core/             HttpClient (the one I/O chokepoint), config, FreshSqueezyError, shared types
resources/        thin JSON:API wrappers — one file per resource (getX / listX)
support/          static manifest (webhook policy, acknowledged changelog) + drift snapshot
validate/         the product — one validator per resource + doctor() composition + rules/probe
augmentations.ts  isolated .d.ts helpers for SDK users (imports only generated/)
cli/              commander + @inquirer/prompts shell over the library
scripts/          build/CI tooling (.mjs) — changelog drift + API-type generation
index.ts          flat public barrel (export * — the whole graph is public)
```

## Core flow

1. `createFreshSqueezy(config)` resolves env + builds one `HttpClient`.
2. A validator fetches through `probeFetch`/`probeCollection` (the only place a network
   throw is caught), then runs pure `check*` assertions over the returned attributes.
3. It returns a `ValidationResult` — never throws — with `ok` derived from issue severity.
4. `doctor()` composes validators: connection first (short-circuits on failure), then the
   rest, into a `DoctorReport`.
5. The CLI renders the report (human or `--json`) and exits with a stable code.

## Boundaries / non-goals

Validator-first (no passthroughs that hide HTTP calls); one HTTP layer; stable
`ValidationResult` / `issue.code` shape (breaking = major bump); mode-awareness on every
result; static support manifest + drift snapshot (no live changelog scraping at runtime).
See `PROJECT.md` for direction and `docs/adr/current/` for the why.
