# CODE-STYLE.md

How code is written in fresh-squeezy. Prescriptive (how to write), not descriptive
(what exists — that's `AGENTS.md`). The rules digest is mirrored into `AGENTS.md`; this
file is the source — edit here. `deslop` reads this file to enforce style per-diff.

## Stack & framework practices

Plain Node 20+ TypeScript (native `fetch`), no runtime framework. For the surfaces that
have a dedicated skill, defer to it instead of restating:

- CLI/TUI flows (commander + `@inquirer/prompts`, dual-mode) → `interactive-cli-reviewer`
- Per-diff style enforcement → `deslop`
- Commit-time formatting (optional) → `setup-pre-commit`

vitest / tsup / Biome conventions live here and in their own docs. This file covers only
what is specific to fresh-squeezy.

## Scripts — shared `package.json` contract

This repo follows the **workspace-wide script contract** — the same script _names_ across every
sibling repo so muscle memory and CI carry across projects. SSOT + full table:
`dufflebag/templates/mdFiles/CODE-STYLE.md → Scripts`. Only `dev`/`build`/`start` bend to the stack.

- **Canonical names** — `dev` · `build` · `cli` · `test` (`vitest run`) · `test:watch` ·
  `test:coverage` · `typecheck` (`tsc --noEmit`) · `lint` (`biome check .`) ·
  `lint:fix` (`biome check --write .`) · `format` (`biome format --write .`) · `check:ci` (`biome ci .`) ·
  `verify` — the one gate (`check:ci && typecheck && test && build`).
- **`ns:action`** — variants nest under `:` (`test:watch`, `test:coverage`, `lint:fix`), never a dash.
- **One `verify` gate** — never re-split into `qa`/`quality`/`validate`.
- **`cli`** — the interactive front door (bare = menu, `-- <sub>` = direct, non-TTY never hangs).

_Aligned 2026-07-02:_ added `lint:fix` and `verify`. The `cli` is exposed via the published
`fresh-squeezy` bin — there is no `tsx` dev-runner in this repo, so no source-run `cli` dev script.

### `scripts/dev/` — local-only tooling (gitignored)

Scripts for local debugging, one-off experiments, or personal dev utilities go in `scripts/dev/`. This folder is **gitignored** — it never reaches the remote. Production scripts stay at the `scripts/` root.

When creating a new script, ask: _"Would CI or another contributor need this?"_ If **no** → `scripts/dev/`.

## Rules

### Const arrow functions only (no `function` / `async function` declarations)
Every module-scope callable is a **`const` arrow** — sync or async. Never
`function name()` or `async function name()` at module scope (or nested helpers).
Class methods on `HttpClient` are the only exception (they stay methods).
```ts
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
```
_Why:_ one call-shape everywhere; no hoisting games; matches how agents and modern TS write. Helpers must be declared before use (const is not hoisted).

### Named exports only, pure wildcard barrels
Zero `export default`. Public surface is **only** `export * from "…"` in barrel files
(`src/index.ts`, and any future `index.ts` / `index.tsx`). No named re-export lists,
no `export { foo } from`, no import-then-re-export after the import block.

```ts
// ✓ src/index.ts — pure wildcard barrel
export * from "./validate/store.js";
export * from "./resources/webhooks.js";

// ✗ not this — after-imports re-export / named barrel
import { getProduct } from "./resources/products.js";
export { getProduct };
export { createFreshSqueezy } from "./createFreshSqueezy.js";
export type { Mode } from "./core/types.js"; // use export * (types ride along)
```
_Why:_ one greppable public graph; barrels stay mechanical and agent-safe.

### No backward-compatibility shims
When style or API shape changes, **rewrite callers** — do not leave dual forms,
deprecated aliases, `// kept for BC`, or parallel `function` + arrow exports.
Major bumps own real public contract breaks (`issue.code`, `ValidationResult`);
internal style is not a BC surface.

### Guard-clause early returns + imperative `issues[]`
Fail-path first; accumulate with `push`; end in `buildResult`. No functional map/filter
chains for issue building.
```ts
// after — src/validate/store.ts:26
const issues: ValidationIssue[] = [];
if (!fetched.ok) {
  issues.push(fetched.issue);
  return buildResult<StoreAttributes>("store", mode, issues, undefined, target);
}
return buildResult("store", mode, issues, fetched.resource.attributes, target);
```

### interface for shapes, type for unions, as const for tables
Object shapes are `interface`; unions/discriminated shapes are `type`; literal lookup
tables are `as const` and sit at the top of the file, directly after imports — never below
a function.
```ts
export interface ValidationResult<T = unknown> { ok: boolean; mode: Mode; /* … */ }
export type Mode = "test" | "live";
export const ISSUE_CODES = { STORE_NOT_FOUND: "STORE_NOT_FOUND", /* … */ } as const;
```

### unknown never any; one FreshSqueezyError
Boundaries take `unknown` and narrow with a cast. Never `any` in hand-written code. All
failures use the single `FreshSqueezyError` (carries `code`/`status`); callers branch on
`.code`. Validators convert it to an issue and never re-throw.
```ts
// src/core/http.ts:181
const errors = (body as { errors?: unknown }).errors;
```

### Layers are one-directional; core/ is the foundation
Import direction is strictly `generated → core → resources → validate → cli`. `core/`
imports only from `core/` and `generated/` — never up into `resources/`, `validate/`, or
`cli/`. Pure helpers live in `core/`; anything doing I/O against a resource lives at
`resources/` or above.
```ts
// avoid — src/core/mode.ts reaching up into resources/ (fetchActualMode)
import { getAuthenticatedUser } from "../resources/users.js";
// after — the pure half stays in core/, the I/O half moves out of core/
export const resolveActualMode = (
  testMode: boolean | undefined,
): Mode | undefined => { /* … */ };
```

### Validators: pure check*() + thin fetch (rich validators)
Validators with real assertion logic (`product`, `discount`, `licenseKey`,
`subscriptionPlan`) extract a pure `check<Resource>(attributes): ValidationIssue[]`; the
async validator does the fetch and delegates. Thin validators (`store`, `connection`) stay
fused. Mirrors the existing `mode.ts`/`probe.ts` pure-vs-I/O split.
```ts
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
```
_Why:_ the rules become unit-testable with plain data, no mock fetch.

### Error → issue conversion goes through a shared wrapper
Single-resource fetches use `probeFetch`; collection/composite fetches use
`probeCollection` (sibling). Never hand-roll the `FreshSqueezyError` → issue mapping; never
a silent `catch {}` — a best-effort skip carries a one-line comment or emits an info issue.
```ts
// after — src/validate/webhook.ts
const probed = await probeCollection(() => listWebhooksForStore(http, storeId), {
  notFoundCode: ISSUE_CODES.WEBHOOK_NOT_FOUND,
});
if (!probed.ok) { issues.push(probed.issue); return buildResult(/* … */); }
```

### TSDoc: why + @param + @returns + @example
Every exported function gets a `/** … */` block with:
- summary (_why_, not restating the name)
- `@param` for each parameter
- `@returns` for the **single** return type
- `@example` with a real call
- `@throws {FreshSqueezyError}` on resource ops that throw

Interfaces/types/consts still get a why-summary. Agents rely on this contract.
```ts
/**
 * Retrieve a product (GET /v1/products/:id). Catalog is read-only in the API.
 *
 * @param http - Shared API client.
 * @param productId - Product id.
 * @returns The product JSON:API resource.
 * @throws {FreshSqueezyError} On HTTP/network failure.
 *
 * @example
 * ```ts
 * const product = await getProduct(http, 42);
 * ```
 */
export const getProduct = async (
  http: HttpClient,
  productId: string | number,
): Promise<JsonApiResource<ProductAttributes>> => { /* … */ };
```

### Single named return — no multi-object bags
A function returns **one** value of **one** named type. Never `return { product, variants }`
or bare tuples of independent entities. Discriminated results (`ValidationResult`,
`FetchProbeOutcome`) and named DTOs (`ResolveStoresOutput`) are fine — they are one type.
If two entities are needed, use two functions or a named composite with a job.

### Docs-backed resource verbs only
`resources/` may expose create/update/delete/cancel/refund/… **only** when
docs.lemonsqueezy.com/api documents them. Register every verb in
`src/resources/registry.ts` with a `docsPath`. Never invent catalog writes
(product/variant/price create). CLI hybrid verbs and nested `createFreshSqueezy()`
namespaces call `invokeOp` / the same helpers.

### Naming
Files `camelCase` (even when the CLI verb is kebab: `subscriptionPlan.ts` ↔
`subscription-plan`). Functions `verbNoun` (`validateStore`, `getStore`, `listStores`,
`runDoctorCommand`). Constants `SCREAMING_SNAKE_CASE`; types `PascalCase`; generated types
`Generated*`; augmentations `Latest*Fields`.

### Formatting
Biome owns it (`biome.json`, ADR-0001): double quotes, semicolons, width 100, trailing
commas everywhere, `node:` → third-party → local import order. Run `npm run format` /
`npm run lint`. Don't hand-format against it.

## Recipes

### How to add a validator
1. If the resource isn't in `src/resources/`, add a thin file: `*Attributes extends Generated*Attributes` + `getX`/`listX`.
2. Add issue codes to `ISSUE_CODES` in `rules.ts` (stable public API).
3. Add `src/validate/<name>.ts`. Rich logic → extract a pure `check<Name>(attributes): ValidationIssue[]`; fetch via `probeFetch`/`probeCollection`; build with `buildResult`.
4. Export it from `src/index.ts` (`export * from "./validate/<name>.js"`).
5. Unit-test the pure `check<Name>` with plain fixtures; test the async validator via `makeClient` + `createMockFetch`.
6. Wire into `doctor()` if it belongs in the default sweep.
7. Mirror as `fresh-squeezy validate <name>` in `src/cli/main.ts`; add it to the interactive menu.
8. Update the README table.

### How to add a CLI command
1. Add the handler in `src/cli/commands/<verb>.ts` as `run<Verb>Command(options)` returning an exit code.
2. Register it on `program` in `src/cli/main.ts` with commander flags.
3. Honor the dual-mode contract: flags/non-TTY defer and never hang; the interactive path prompts via `@inquirer/prompts`; both routes call the same `run<Verb>Command`.
4. Add the verb to the bare-invocation menu (`pickLauncherAction`).
5. Render via `src/cli/render.ts`; support `--json`.
6. Unit-test with a stubbed `fetch` (`vi.stubGlobal`).

### How to add a resource verb (docs-backed ops)
1. Confirm the endpoint on docs.lemonsqueezy.com/api (or the proposed scrape snapshot).
2. Implement in `src/resources/<x>.ts` via `HttpClient` (`getResource` / `postResource` / `patchResource` / `deleteResource` / `paginate`).
3. Full TSDoc (`@param` / `@returns` / `@example` / `@throws`).
4. Register in `resourceRegistry` (`docsPath`, body, destructive?, idRole).
5. Wire `invokeOp` + nested client method on `createFreshSqueezy()`.
6. Tests for path/method; safety covered by CLI (`--yes`, live gate).
7. Definition of done: `pnpm verify`, registry entry present, no raw `fetch`, single return type.

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
