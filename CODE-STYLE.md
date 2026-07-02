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

## Rules

### Function declarations at module scope
Every module-scope callable is a `function` declaration. Arrows are for inline callbacks
only (`.map`, `.filter`).
```ts
// avoid
export const validateStore = async (http, mode, id) => { /* … */ };
// after — src/validate/store.ts
export async function validateStore(
  http: HttpClient, mode: Mode, storeId: string | number,
): Promise<ValidationResult<StoreAttributes>> { /* … */ }
```
_Why:_ one call-shape everywhere; hoisting lets helpers sit below their callers.

### Named exports only, uniform barrel
Zero `export default`. `src/index.ts` is a flat `export *` barrel and stays uniform —
every public module (and every validator) is star-exported.
```ts
// after — src/index.ts (all validators, uniform)
export * from "./validate/store.js";
export * from "./validate/discount.js";
export * from "./validate/licenseKey.js";
export * from "./validate/subscriptionPlan.js";
```
_Why:_ grep-able and rename-safe; the whole graph is intentionally public.

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
export function resolveActualMode(testMode: boolean | undefined): Mode | undefined { /* … */ }
```

### Validators: pure check*() + thin fetch (rich validators)
Validators with real assertion logic (`product`, `discount`, `licenseKey`,
`subscriptionPlan`) extract a pure `check<Resource>(attributes): ValidationIssue[]`; the
async validator does the fetch and delegates. Thin validators (`store`, `connection`) stay
fused. Mirrors the existing `mode.ts`/`probe.ts` pure-vs-I/O split.
```ts
// after — src/validate/product.ts
export function checkProduct(attrs: ProductAttributes, storeId?: string): ValidationIssue[] { /* … */ }
export async function validateProduct(http, mode, id, storeId?) {
  const f = await probeFetch(() => getProduct(http, id), { /* … */ });
  if (!f.ok) return buildResult("product", mode, [f.issue], undefined, target);
  return buildResult("product", mode, checkProduct(f.resource.attributes, storeId), f.resource.attributes, target);
}
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

### JSDoc the why on every exported symbol
Every exported function/interface/type/const gets a `/** … */` block explaining the _why_,
not the _what_.
```ts
/**
 * Stable issue codes. Consumers may switch on these in CI — do not rename
 * without a major version bump.
 */
export const ISSUE_CODES = { /* … */ } as const;
```

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

## Exemplars

Write new code like these:
- `src/validate/store.ts` — the validator skeleton (probeFetch → guard → buildResult).
- `src/validate/rules.ts` — `issue`/`buildResult` helpers + `ISSUE_CODES` as const.
- `src/core/http.ts` — the single I/O chokepoint; unknown-narrowing; JSDoc density.
- `src/core/mode.ts` — pure (`resolveActualMode`) vs I/O (`fetchActualMode`) split.
- `src/validate/store.test.ts` — `makeClient` + `createMockFetch` + fixture assertions (colocated beside `store.ts`).

## Never
- `export default` — named exports only.
- Top-level arrow bindings — `function` declarations at module scope.
- `any` in hand-written code — `unknown` + a narrowing cast.
- `fetch` outside `core/http.ts` — one transport chokepoint.
- Upward imports from `core/` — it imports only `core/` + `generated/`.
- Silent `catch {}` — comment the skip or emit an info issue.
- Hand-rolled `FreshSqueezyError` → issue mapping — use `probeFetch`/`probeCollection`.
- `SCREAMING_SNAKE` consts below functions — they sit at the top, after imports.
