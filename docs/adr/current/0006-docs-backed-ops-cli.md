# ADR-0006: Docs-backed ops CLI + nested client

## Status

Accepted — 2026-07-11

## Context

fresh-squeezy started as a validator-only doctor. We need dual-mode setup and day-2
operations without becoming a fantasy SDK that invents Lemon Squeezy endpoints. Official
docs show catalog resources (products, variants, prices, files, stores) are **read-only**;
writes exist for webhooks, discounts, customers, checkouts, subscription lifecycle,
refunds, usage records, and similar.

## Decision

1. **Identity:** ops + doctor. Not an app-embedding SDK.
2. **Matrix:** `resourceRegistry` lists only documented verbs (`docsPath` required).
3. **Implementation:** thin helpers in `resources/*`; `invokeOp` dispatch; nested
   `createFreshSqueezy().webhooks.create` etc.; CLI hybrid top-level verbs.
4. **Safety:** delete/cancel/refund always gated; live mode gates all mutates; non-TTY
   never prompts (`--yes`).
5. **Bodies:** JSON:API via `--body` / `--body-file`.
6. **TSDoc:** `@param` / `@returns` / `@example` on new public functions; single named return.
7. **Drift:** CI changelog scrape may propose gaps; code+registry ship; validators remain.

## Consequences

- CLI: `get|list|create|update|delete|cancel|refund|generate-invoice|current-usage` + `ops --list`.
- PROJECT.md non-goal #1 evolved (validators not the only landing for endpoints).
- Agent skill at `skills/fresh-squeezy-ops/SKILL.md`.
