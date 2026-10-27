# LANGUAGE.md — fresh-squeezy

The human↔agent glossary: names only. Use these exact terms in code, comments,
commits, and docs; avoid the listed aliases. Orientation lives in `CONTEXT.md`.

## Client

**Client**
The object `createFreshSqueezy` returns: `get`, `list`, `create`, `update`, `remove`, `cancelSubscription`, `refund`, `generateInvoice`, `currentUsage`, plus the checks and the doctor.
_Avoid_: SDK, wrapper, API layer.

**Resource type**
A Lemon Squeezy object name like `"subscriptions"` or `"order-items"`. It picks the attribute, create and update types of a client call.
_Avoid_: endpoint, model, entity.

**FreshSqueezyError**
The one error type: a plain `Error` with `code`, `status` and `detail`, made by `freshSqueezyErrorOf` and checked with `isFreshSqueezyError`.
_Avoid_: ApiError, HttpError.

## Checks

**Check**
A `validate<Resource>` function that fetches one resource and returns a `ValidationResult`.
_Avoid_: validator, rule, test.

**Doctor**
The run of every check for one store into one `DoctorReport`.
_Avoid_: healthcheck, audit, scan.

**Finding**
One `Finding`: `{ code, severity, message, suggestedFix }`. Not an error.
_Avoid_: issue, error, failure, problem.

**Finding code**
The stable string in `FINDING_CODES` that CI switches on, like `MODE_MISMATCH`. Renaming one is a major bump.
_Avoid_: error code, key.

**Finding rule**
One entry of a check's list: when it applies, the code, the message and the suggested fix.
_Avoid_: condition, assertion.

**Mode**
`"test"` or `"live"`: the key's environment. Declared mode against `meta.test_mode` drives `MODE_MISMATCH`.
_Avoid_: environment, stage, sandbox.

**Target**
The `ValidationTarget` (label, id, url) a result points at, like `store 42`.
_Avoid_: subject, entity.

## Upkeep

**Changelog issue**
The GitHub issue labeled `changelog-drift` that the `lemon-squeezy-changelog` workflow opens when the Lemon Squeezy API changelog has a new entry. It is closed by hand after the types and the client follow the entry.
_Avoid_: drift report, update ticket.

## Swaps

| Avoid in code | Use     |
| ------------- | ------- |
| issue         | finding |
