# AGENTS.md

Project-level guidance for coding agents (Codex, Claude Code) working in this repo.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `YosefHayim/fresh-squeezy`, managed via the `gh` CLI.

### Triage labels

Canonical role names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) map 1:1 to GitHub label strings.

### Domain docs

Single-context layout: one `CONTEXT.md` at the repo root.

## Conventions

<!-- rules digest — full guide in CODE-STYLE.md; edit there -->

- **Functions:** `const` arrows only (sync/async) — never `function` / `async function` declarations (class methods ok). Named exports only — zero `export default`. `src/index.ts` is a pure `export *` wildcard barrel — no after-import re-exports, no named `export { x } from`. No BC shims; rewrite callers.
- **Control flow:** guard-clause early returns; validators accumulate `const issues: ValidationIssue[] = []` + `push`, end in `buildResult` — never throw. Resource ops throw `FreshSqueezyError`.
- **Types:** `interface` for shapes, `type` for unions, `as const` for lookup tables (positioned top-of-file, after imports). `unknown` never `any`. One `FreshSqueezyError` (`code`/`status`); callers branch on `.code`. Single named return — no multi-object bags.
- **Layers:** strict `generated → core → resources → validate → cli`. `core/` imports only `core/` + `generated/` — never upward. `fetch` only in `core/http.ts`.
- **Validators:** rich ones (`product`/`discount`/`licenseKey`/`subscriptionPlan`) split a pure `check*(attributes)` from the fetch; thin ones stay fused. Error → issue mapping goes through `probeFetch`/`probeCollection` — no hand-rolled mapping, no silent `catch {}`.
- **Ops:** docs-backed only. `src/resources/registry.ts` holds one `RESOURCES` row per resource; `VERB_RULES` maps each verb to one HTTP call and a docs slug, from which `docsPath` is built. No inventing product/variant create. Nested client + CLI hybrid verbs via `invokeOp`.
- **Tables:** one table per repeated list (`RESOURCES`, `VALIDATE_SUBCOMMANDS`, `OPTIONAL_VALIDATORS`) — add a row, don't re-list in other files.
- **Docs:** TSDoc why + `@param` + `@returns` + `@example` (+ `@throws` on ops). Agent skill: `skills/fresh-squeezy-ops/SKILL.md`.
- **Formatting:** Biome (`pnpm format` / `pnpm lint` / `pnpm check:ci`) — double quotes, semicolons, width 100, trailing commas. See `biome.json`. Gate: `pnpm verify` (`check:ci` + `typecheck` + `test` + `build`).
- **CLI:** bare + TTY → action menu (setup, doctor, manage resources, examples); flags/non-TTY defer, never hang; both call the same command functions. Exit `0`/`1`/`2`/`130`. Live/destructive ops need `--yes` or TTY confirm; `--all`/`--ids` bulk ops confirm once and exit `1` on partial failure. After build: `pnpm cli` → `node dist/cli.js` (published bin).
- **Golden path (resource verb):** docs confirm → verb in the resource's `RESOURCES` row (+ `*Attributes` in `resources/attributes.ts` for a new resource) → nested client method → `createFreshSqueezy.test.ts` row → `pnpm verify`.

Full guide with before/after: `CODE-STYLE.md`. Decisions go in the PR description.

## Repo layout

- **`src/`** — all source. Unit tests are **colocated** as `*.test.ts` beside the module they cover. `resources/` is two files: `registry.ts` (ops table + `invokeOp`) and `attributes.ts` (typed objects); `cli/commands/` has one file per command. Layers import one-directionally: `generated → core → resources → validate → cli`. Build/CI scripts live in `src/scripts/` (`.mjs`, inert to the TS build).
- **`tests/`** — only what has no single owning module: `fixtures/`, `helpers/`, and `live/` (opt-in integration smoke). No unit tests here.
- **`public/`** — README/GitHub assets; **not** published to npm (`files` omits it).
- **Env** — one gitignored `.env`; `.env.example` carries only real secrets (the API key). Mode defaults to `test`; stores come from `--store-ids`.
- **No `bin/`** — the published binary is `dist/cli.js` (shebang added by tsup); `package.json` `bin` points straight at it.

## Local CI

Run `act workflow_dispatch -W .github/workflows/ci.yml` before opening a PR.
The root `.actrc` selects the local Docker runner and keeps the pnpm store outside the workspace.
