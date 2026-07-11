# LANGUAGE.md

Glossary — names only. The human ↔ agent bridge: use these exact terms in code, commits,
issues, and PRs. Definitions plus aliases to avoid. Orientation lives in `CONTEXT.md`.

| Term | Definition | Avoid |
|---|---|---|
| **validator** | A `validate<Resource>` function that fetches one resource and returns a `ValidationResult`. | check (as a noun), rule, test |
| **check** | The pure `check<Resource>(attributes)` half of a rich validator — assertions only, no I/O. | validate (for the pure half) |
| **doctor** | The composition that runs all configured validators into one `DoctorReport`. | healthcheck, audit, scan |
| **issue** | One `ValidationIssue` — `{ code, severity, message }`. Not an error. | error, failure, problem |
| **issue code** | The stable string in `ISSUE_CODES` that CI switches on (e.g. `MODE_MISMATCH`). Renaming = major bump. | error code, key |
| **probe** | The I/O wrapper (`probeFetch` / `probeCollection`) that catches a fetch throw and maps it to an issue. | fetch wrapper, guard |
| **mode** | `"test"` or `"live"` — the key's environment. Declared vs actual (`meta.test_mode`) drives `MODE_MISMATCH`. | environment, stage, sandbox |
| **target** | The `ValidationTarget` (label/id/url) a result points at, e.g. `store 42`. | subject, entity |
| **resource** | A Lemon Squeezy object type (store, product, variant, webhook…) and its thin wrapper in `resources/`. | endpoint, model |
| **augmentation** | A `Latest*Fields` `.d.ts` helper that adds changelog fields to the official SDK's types. | patch, override, shim |
| **support manifest** | `src/support/manifest.ts` — locally reviewed webhook policy + acknowledged changelog entries. | config, registry |
| **drift** | Divergence between the live Lemon Squeezy changelog and the committed snapshot. | diff, delta |
| **FreshSqueezyError** | The single error class (`code`/`status`) thrown by the HTTP layer and for programmer-errors. | ApiError, HttpError |
| **resource verb** | One docs-backed operation on a resource (`get`, `create`, `cancel`, `refund`, …). | endpoint method, CRUD (when non-CRUD) |
| **resourceRegistry** | `src/resources/registry.ts` — implemented ops with `docsPath`; what ships in CLI/client. | OpenAPI, route table |
| **ops command** | Hybrid CLI: `get\|list\|create\|update\|delete\|cancel\|refund\|generate-invoice\|current-usage <resource>`. | admin API, SDK call |
| **write safety** | Gates for mutate: delete/cancel/refund always; all writes in live; `--yes` or TTY confirm; never prompt non-TTY. | confirm flag only |
| **body input** | JSON:API document via `--body` / `--body-file` (not flag-per-field). | form fields, query params |
