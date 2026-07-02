# ADR-0004: Layer direction and validator purity

## Status

Accepted — 2026-07-02

## Context

The `generated → core → resources → validate → cli` layering is a clean DAG with one
violation: `src/core/mode.ts::fetchActualMode` imports `getAuthenticatedUser` from
`resources/users.ts`, so the foundation layer reaches upward. Separately, the main
validators fuse I/O (`probeFetch`) with pure attribute assertions in one function — unlike
`mode.ts` and `probe.ts`, which already separate the pure half (`resolveActualMode`,
`checkStoreOwnership`) from the I/O half.

## Decision

1. **Layer purity.** `core/` imports only from `core/` and `generated/`, never upward. The
   pure `resolveActualMode` stays in `core/mode.ts`; the I/O `fetchActualMode` moves out of
   `core/` (to `validate/`, next to its only caller `validateConnection`).
2. **Validator purity (rich validators only).** Validators with real logic (`product`,
   `discount`, `licenseKey`, `subscriptionPlan`) extract a pure `check<Resource>(attributes):
   ValidationIssue[]`; the async validator fetches and delegates. Thin validators (`store`,
   `connection`) stay fused — there is nothing to isolate.

## Consequences

- The one upward edge is removed; `core/` is genuinely foundational.
- Rich validation rules become unit-testable with plain data, no mock fetch.
- Follow-on code work; the "add a validator" recipe in `CODE-STYLE.md` reflects the split.
- Not adopted: splitting every validator (would add hollow `check*()` functions to `store`
  and `connection` for no gain).
