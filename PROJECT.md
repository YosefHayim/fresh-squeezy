# PROJECT.md — fresh-squeezy

Purpose and direction: why this exists and where it is going. What it is and how it fits
live in `CONTEXT.md`.

## The problem

The official `@lemonsqueezy/lemonsqueezy.js` last shipped on 2024-11-05, while the API
kept changing. And Lemon Squeezy setup mistakes fail silently in production: a production
key pointed at a test store, an unpublished product behind a live buy button, a webhook
missing the events fulfillment needs.

## Who it's for

- Developers who call the Lemon Squeezy API from TypeScript and want types that follow the API changelog.
- Developers integrating Lemon Squeezy who want a check before release.
- CI pipelines that gate a deploy on a machine-readable billing report.
- Agents that read and change Lemon Squeezy data and run the doctor.

## The core insight

A thin typed client with zero dependencies is easy to keep current when its types sit in
one file and a workflow flags every changelog entry. The same client reads the store, so
each mistake becomes a stable finding code and a stable exit code.

## Goals

- Every call the Lemon Squeezy docs list is in the client, with types that match the API.
- A new changelog entry becomes an issue within two weeks.
- A broken setup exits non-zero with a specific, stable `finding.code`.
- A correct setup exits `0` with no false positives.
- `--json` output is stable enough for CI to switch on without reading prose.

## Non-goals

- No invented writes: products, variants and prices have no create or update API.
- No prompts, menus or interactive flows: the CLI takes flags only.
- No bulk operations, launcher or command registry on top of the client.
- No live changelog scraping at runtime.

## Direction

- **Built:** the client for the 20 documented resources, the keyless license API, the doctor with its 7 checks, the changelog workflow.
- **Next:** the major release that ships the lean client and drops the old ops, menus and SDK augmentations.

## Guiding principles

1. **Only documented calls.** A client call exists because the Lemon Squeezy docs list it.
2. **One HTTP layer.** Auth, error mapping and retry live in `shared/http.ts`.
3. **Stable contract.** Finding codes, `ValidationResult` and exit codes are public API; breaking one is a major bump.
4. **Checks never throw.** A failed fetch becomes a finding.
5. **Mode everywhere.** Every result names its mode; a live write needs the user's yes.
