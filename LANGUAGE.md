# LANGUAGE.md — fresh-squeezy

The human↔agent glossary: names only. Use these exact terms in code, comments,
commits, and docs; avoid the listed aliases. Orientation lives in `CONTEXT.md`.

## Terms

**validator**
A `validate<Resource>` function that fetches one resource and returns a `ValidationResult`.
_Avoid_: check (as a noun), rule, test.

**check**
The pure `check<Resource>(attributes)` half of a rich validator — assertions only, no I/O.
_Avoid_: validate (for the pure half).

**doctor**
The composition that runs all configured validators into one `DoctorReport`.
_Avoid_: healthcheck, audit, scan.

**issue**
One `ValidationIssue` — `{ code, severity, message }`. Not an error.
_Avoid_: error, failure, problem.

**issue code**
The stable string in `ISSUE_CODES` that CI switches on (e.g. `MODE_MISMATCH`). Renaming = major bump.
_Avoid_: error code, key.

**probe**
The I/O wrapper (`probeFetch` / `probeCollection`) that catches a fetch throw and maps it to an issue.
_Avoid_: fetch wrapper, guard.

**mode**
`"test"` or `"live"` — the key's environment. Declared vs actual (`meta.test_mode`) drives `MODE_MISMATCH`.
_Avoid_: environment, stage, sandbox.

**target**
The `ValidationTarget` (label/id/url) a result points at, e.g. `store 42`.
_Avoid_: subject, entity.

**resource**
A Lemon Squeezy object type (store, product, variant, webhook…) and its thin wrapper in `resources/`.
_Avoid_: endpoint, model.

**augmentation**
A `Latest*Fields` `.d.ts` helper that adds changelog fields to the official SDK's types.
_Avoid_: patch, override, shim.

**support manifest**
`src/support/manifest.ts` — locally reviewed webhook policy + acknowledged changelog entries.
_Avoid_: config, registry.

**drift**
Divergence between the live Lemon Squeezy changelog and the committed snapshot.
_Avoid_: diff, delta.

**FreshSqueezyError**
The single error class (`code`/`status`) thrown by the HTTP layer and for programmer-errors.
_Avoid_: ApiError, HttpError.

**resource verb**
One docs-backed operation on a resource (`get`, `create`, `cancel`, `refund`, …).
_Avoid_: endpoint method, CRUD (when non-CRUD).

**resourceRegistry**
`src/resources/registry.ts` — implemented ops with `docsPath`; what ships in CLI/client.
_Avoid_: OpenAPI, route table.

**ops command**
Hybrid CLI: `get\
_Avoid_: list\.

**write safety**
Gates for mutate: delete/cancel/refund always; all writes in live; `--yes` or TTY confirm; never prompt non-TTY.
_Avoid_: confirm flag only.

**body input**
JSON:API document via `--body` / `--body-file` (not flag-per-field).
_Avoid_: form fields, query params.
