# CONTEXT.md

Orientation for fresh-squeezy — what it is, who touches it, and the shape of the code. Not
a glossary (that's `LANGUAGE.md`) and not the rules (that's `CODE-STYLE.md`).

## What it is

A dual-mode **ops + doctor** tool for Lemon Squeezy: pre-flight validation (stores,
products, webhooks, discounts, license keys, plans, mode) **and** docs-backed resource
operations (get/list/create/update/delete/cancel/refund/… only where the official API
documents them). Catalog objects (products/variants/prices/files/stores) are **read-only**
in the API. It is not an app-embedding SDK — use the official SDK in product code. Ships
as CLI (`npx fresh-squeezy`) and TypeScript library.

## Actors

- **Developer at a terminal** — bare TTY menu (doctor / init / …); hybrid ops
  (`get|list|create|… <resource>`); prompts for confirms on destructive/live writes.
- **CI runner / agent** — `doctor --json` and ops with flags + `--yes`; never hangs;
  exit codes 0/1/2/130.
- **Library consumer** — `createFreshSqueezy()`: flat `validate*` + nested ops
  (`client.webhooks.create`, `client.products.get`); switch on `issue.code` for doctor.
- **The weekly drift workflow** — changelog snapshot + proposed ops gaps; never edits
  runtime code automatically.

## Shape

Layer-based, strict one-directional imports (`generated → core → resources → validate →
cli`):

```
generated/        auto-generated Lemon Squeezy attribute types
core/             HttpClient (the one I/O chokepoint), config, FreshSqueezyError, shared types
resources/        JSON:API helpers + registry + invokeOp (docs-backed verbs only)
support/          static manifest (webhook policy, acknowledged changelog) + drift snapshot
validate/         doctor validators — check*/validate* + composition + rules/probe
skills/           agent SKILL.md for ops+doctor usage
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
