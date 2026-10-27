# LANGUAGE.md — fresh-squeezy

The human↔agent glossary: names only. Use these exact terms in code, comments,
commits, and docs; avoid the listed aliases. Orientation lives in `CONTEXT.md`.

## Checks

**Validator**
A `validate<Resource>` function that fetches one resource and returns a `ValidationResult`.
_Avoid_: check (as a noun), rule, test.

**Check**
The pure `check<Resource>(attributes)` half of a validator: assertions only, no I/O.
_Avoid_: validate (for the pure half).

**Optional validator**
A validator `init` and `doctor --all-resources` can add: product, webhook, discount, license key, subscription plan.
_Avoid_: doctor target, resource check.

**Doctor**
The run of every configured validator into one `DoctorReport`.
_Avoid_: healthcheck, audit, scan.

**Issue**
One `ValidationIssue`: `{ code, severity, message }`. Not an error.
_Avoid_: error, failure, problem.

**Issue code**
The stable string in `ISSUE_CODES` that CI switches on, like `MODE_MISMATCH`. Renaming one is a major bump.
_Avoid_: error code, key.

**Probe**
The wrapper (`probeFetch`, `probeCollection`) that turns a failed fetch into an issue.
_Avoid_: fetch wrapper, guard.

**Mode**
`"test"` or `"live"`: the key's environment. Declared mode against `meta.test_mode` drives `MODE_MISMATCH`.
_Avoid_: environment, stage, sandbox.

**Target**
The `ValidationTarget` (label, id, url) a result points at, like `store 42`.
_Avoid_: subject, entity.

## Ops

**Resource**
A Lemon Squeezy object type (store, product, variant, webhook...) with one `RESOURCES` row and one `*Attributes` type.
_Avoid_: endpoint, model.

**Resource verb**
One docs-backed operation on a resource: `get`, `create`, `cancel`, `refund`...
_Avoid_: endpoint method, CRUD (when not CRUD).

**Resource registry**
The `resourceRegistry` table of implemented resource verbs with their `docsPath`. It is what the CLI and the client ship.
_Avoid_: OpenAPI, route table.

**Ops command**
A CLI command shaped `<verb> <resource>`, like `get store` or `refund order`.
_Avoid_: admin API, SDK call.

**Write safety**
The gates on a write: delete, cancel and refund always confirm; every live write confirms; `--yes` or a TTY confirm; never a prompt without a TTY.
_Avoid_: confirm flag only.

**Body input**
A JSON:API document passed with `--body` or `--body-file`, never one flag per field.
_Avoid_: form fields, query params.

**FreshSqueezyError**
The one error type: a plain `Error` with `code`, `status` and `detail`, made by `freshSqueezyErrorOf` and checked with `isFreshSqueezyError`.
_Avoid_: ApiError, HttpError.

## Upkeep

**Support manifest**
The reviewed webhook policy plus the acknowledged changelog entries.
_Avoid_: config, registry.

**Drift**
The difference between the live Lemon Squeezy changelog and the committed snapshot.
_Avoid_: diff, delta.

**Augmentation**
A `Latest*Fields` type that adds new changelog fields to the official SDK's types.
_Avoid_: patch, override, shim.
