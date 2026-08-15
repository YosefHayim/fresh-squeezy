# fresh-squeezy code style

How code is written in fresh-squeezy. Prescriptive (how to write), not descriptive
(what exists — that's `AGENTS.md`). The rules digest is mirrored into `AGENTS.md`; this
file is the source — edit here. `deslop` reads this file to enforce style per-diff.

## How to read a rule

| Slot | Meaning |
| --- | --- |
| rule ID | Stable review and detector key |
| verify | Cheapest command that proves the rule, or judgment |
| chosen / rejected | The local idiom and the concrete failure shape |

## Rules

### `scripts/dev/` — local-only tooling (gitignored)
[rule:local.only-tooling-gitignored] · verify: judgment

Scripts for local debugging, one-off experiments, or personal dev utilities go in `scripts/dev/`.

```ts
// ✓ fresh-squeezy idiom

// ✗ rejected shape
```

Why: Keeps the local idiom consistent and reviewable.


### Const arrow functions only (no `function` / `async function` declarations)
[rule:const.arrow-functions-only-no-declarations] · verify: judgment

Every module-scope callable is a **`const` arrow** — sync or async.

```ts
// ✓ chosen
// avoid
export async function validateStore(http, mode, storeId) { /* … */ }
function parseMode(value: string): Mode { /* … */ }

// after — const arrows only
export const validateStore = async (
  http: HttpClient,
  mode: Mode,
  storeId: string | number,
): Promise<ValidationResult<StoreAttributes>> => { /* … */ };

const parseMode = (value: string): Mode => { /* … */ };
// ✗ rejected
```

Why: Keeps the local idiom consistent and reviewable.


### Named exports only, pure wildcard barrels
[rule:named.exports-only-pure-wildcard-barrels] · verify: judgment

Zero `export default`.

```ts
// ✓ src/index.ts — pure wildcard barrel
export * from "./validate/store.js";
export * from "./resources/webhooks.js";

// ✗ — after-imports re-export / named barrel
import { getProduct } from "./resources/products.js";
export { getProduct };
export { createFreshSqueezy } from "./createFreshSqueezy.js";
export type { Mode } from "./core/types.js"; // use export * (types ride along)
```

Why: Keeps the local idiom consistent and reviewable.


### No backward-compatibility shims
[rule:no.backward-compatibility-shims] · verify: judgment

When style or API shape changes, **rewrite callers** — do not leave dual forms, deprecated aliases, `// kept for BC`, or parallel `function` + arrow exports.

```ts
// ✓ fresh-squeezy idiom

// ✗ rejected shape
```

Why: Keeps the local idiom consistent and reviewable.


### Guard-clause early returns + imperative `issues[]`
[rule:guard.clause-early-returns-imperative] · verify: judgment

Fail-path first; accumulate with `push`; end in `buildResult`.

```ts
// ✓ chosen
// after — src/validate/store.ts:26
const issues: ValidationIssue[] = [];
if (!fetched.ok) {
  issues.push(fetched.issue);
  return buildResult<StoreAttributes>("store", mode, issues, undefined, target);
}
return buildResult("store", mode, issues, fetched.resource.attributes, target);
// ✗ rejected
```

Why: Keeps the local idiom consistent and reviewable.


### interface for shapes, type for unions, as const for tables
[rule:interface.for-shapes-type-for-unions] · verify: judgment

Object shapes are `interface`; unions/discriminated shapes are `type`; literal lookup tables are `as const` and sit at the top of the file, directly after imports — never below a function.

```ts
// ✓ chosen
export interface ValidationResult<T = unknown> { ok: boolean; mode: Mode; /* … */ }
export type Mode = "test" | "live";
export const ISSUE_CODES = { STORE_NOT_FOUND: "STORE_NOT_FOUND", /* … */ } as const;
// ✗ rejected
```

Why: Keeps the local idiom consistent and reviewable.


### unknown never any; one FreshSqueezyError
[rule:unknown.never-any-one-freshsqueezyerror] · verify: judgment

Boundaries take `unknown` and narrow with a cast.

```ts
// ✓ chosen
// src/core/http.ts:181
const errors = (body as { errors?: unknown }).errors;
// ✗ rejected
```

Why: Keeps the local idiom consistent and reviewable.


### Layers are one-directional; core/ is the foundation
[rule:layers.are-one-directional-core-is] · verify: judgment

Import direction is strictly `generated → core → resources → validate → cli`.

```ts
// ✓ chosen
// avoid — src/core/mode.ts reaching up into resources/ (fetchActualMode)
import { getAuthenticatedUser } from "../resources/users.js";
// after — the pure half stays in core/, the I/O half moves out of core/
export const resolveActualMode = (
  testMode: boolean | undefined,
): Mode | undefined => { /* … */ };
// ✗ rejected
```

Why: Keeps the local idiom consistent and reviewable.


### Validators: pure check*() + thin fetch (rich validators)
[rule:validators.pure-check-thin-fetch-rich] · verify: judgment

Validators with real assertion logic (`product`, `discount`, `licenseKey`, `subscriptionPlan`) extract a pure `check<Resource>(attributes): ValidationIssue[]`; the async validator does the fetch and delegates.

```ts
// ✓ chosen
// after — src/validate/product.ts
export const checkProduct = (
  attrs: ProductAttributes,
  storeId?: string,
): ValidationIssue[] => { /* … */ };

export const validateProduct = async (http, mode, id, storeId?) => {
  const f = await probeFetch(() => getProduct(http, id), { /* … */ });
  if (!f.ok) return buildResult("product", mode, [f.issue], undefined, target);
  return buildResult("product", mode, checkProduct(f.resource.attributes, storeId), f.resource.attributes, target);
};
// ✗ rejected
```

Why: Keeps the local idiom consistent and reviewable.


### Error → issue conversion goes through a shared wrapper
[rule:error.issue-conversion-goes-through-a] · verify: judgment

Single-resource fetches use `probeFetch`; collection/composite fetches use `probeCollection` (sibling).

```ts
// ✓ chosen
// after — src/validate/webhook.ts
const probed = await probeCollection(() => listWebhooksForStore(http, storeId), {
  notFoundCode: ISSUE_CODES.WEBHOOK_NOT_FOUND,
});
if (!probed.ok) { issues.push(probed.issue); return buildResult(/* … */); }
// ✗ rejected
```

Why: Keeps the local idiom consistent and reviewable.


### TSDoc on public functions
[rule:tsdoc.why-param-returns-example] · verify: judgment

Every exported function gets a docblock with a why-summary, @param for each parameter, @returns for the single return type, and an @example with a real call.

```ts
// ✓ chosen
/** Retrieve a product. @param http Shared client. @returns Product resource. */
export const getProduct = async (http: HttpClient, productId: string): Promise<Product> => {
  return http.get(`/v1/products/${productId}`);
};

// ✗ rejected — bare export with no contract docs
export const getProduct = async (http: HttpClient, productId: string) => http.get(`/v1/products/${productId}`);
```

Why: Public call sites need the contract without reading the body.

### Single named return
[rule:single.named-return-no-multi-object] · verify: judgment

A function returns one value of one named type and never an ad-hoc multi-entity bag.

```ts
// ✓ fresh-squeezy idiom
export const buildValidationResult = (issues: Issue[]): ValidationResult => ({ issues });

// ✗ rejected shape
return { product, store, issues };
```

Why: Callers should not unpack independent entities from one return.

### Docs-backed resource verbs only
[rule:docs.backed-resource-verbs-only] · verify: judgment

Resource ops exist only when the Lemon Squeezy docs define them in the registry.

```ts
// ✓ registry entry for a documented verb
registerOp({ resource: 'products', verb: 'list', method: 'GET', path: '/v1/products' });

// ✗ invented endpoint
registerOp({ resource: 'products', verb: 'create', method: 'POST', path: '/v1/products' });
```

Why: The registry is docs-backed so agents do not invent APIs.

### Naming
[rule:naming] · verify: judgment

Files use camelCase even when the CLI verb is kebab-case.

```ts
// ✓ subscriptionPlan.ts for CLI subscription-plan
// ✗ subscription-plan.ts under src/
```

Why: Greppable paths and consistent module imports.

### Formatting
[rule:formatting] · verify: judgment

Biome owns formatting with double quotes, semicolons, width 100, trailing commas, and organized imports.

```ts
// ✓ biome-formatted module
import { HttpClient } from "./http.js";

// ✗ hand-styled drift
import {HttpClient} from './http.js'
```

Why: Mechanical style should disappear into one deterministic command.

## Canonical example

Compose one real feature slice that shows the rules together. Point at real paths once code exists.

## Golden path — adding a unit

1. Name vocabulary changes in LANGUAGE.md / CONTEXT.md when needed.
2. Implement at the owning path for this repository.
3. Wire the unit at its registration seam.
4. Colocate or place tests per the rules above and run the project gate.

Definition of done:

- Focused tests pass.
- Style and typecheck pass.
- No `## Never` tell was introduced.

## Exemplars

Write new code like these:
- `src/resources/products.ts` — thin read helpers; catalog honesty.
- `src/resources/webhooks.ts` — full docs-backed write verbs + TSDoc.
- `src/resources/registry.ts` / `invokeOp.ts` — matrix + dispatch.
- `src/validate/product.ts` — rich check*/validate* + probe + buildResult.
- `src/cli/commands/doctor.ts` — dual-mode command exit codes.
- `src/cli/commands/resourceOps.ts` — ops safety + body + JSON.
- `src/core/http.ts` — single I/O chokepoint.
- `src/cli/commands/init.ts` — multi-step interactive flow.

## Never

- `export default` — named exports only.
- `function` / `async function` declarations — `const` arrows only (class methods excepted).
- After-import re-exports (`import { x }; export { x }`) or named `export { x } from`.
- Backward-compat dual APIs or style shims — rewrite, don't parallel-path.
- `any` in hand-written code — `unknown` + a narrowing cast.
- `fetch` outside `core/http.ts` — one transport chokepoint.
- Upward imports from `core/` — it imports only `core/` + `generated/`.
- Silent `catch {}` — comment the skip or emit an info issue.
- Hand-rolled `FreshSqueezyError` → issue mapping — use `probeFetch`/`probeCollection`.
- `SCREAMING_SNAKE` consts below functions — they sit at the top, after imports.
- Invented LS endpoints (e.g. `createProduct`) — registry is docs-backed only.
- Multi-object ad-hoc returns (`{ a, b }` independent entities).
- Export without `@param` / `@returns` / `@example` on new public functions.
- Live mutate / delete / cancel / refund without `--yes` or TTY confirm.
- Prompt when `!stdin.isTTY`.

## Stack and framework practices

Plain Node 20+ TypeScript (native `fetch`), no runtime framework. For the surfaces that
have a dedicated skill, defer to it instead of restating:

- CLI/TUI flows (commander + `@inquirer/prompts`, dual-mode) → `interactive-cli-reviewer`
- Per-diff style enforcement → `deslop`
- Commit-time formatting (optional) → `setup-pre-commit`

vitest / tsup / Biome conventions live here and in their own docs. This file covers only
what is specific to fresh-squeezy.
