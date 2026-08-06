# AGENTS.md

Project-level guidance for Codex working in this repo.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `YosefHayim/fresh-squeezy`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) map 1:1 to GitHub label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` and `docs/adr/` at the repo root (created lazily by `/grill-with-docs`). See `docs/agents/domain.md`.

## Conventions

<!-- rules digest — full guide in CODE-STYLE.md; edit there -->

- **Functions:** `const` arrows only (sync/async) — never `function` / `async function` declarations (class methods ok). Named exports only — zero `export default`. `src/index.ts` is a pure `export *` wildcard barrel — no after-import re-exports, no named `export { x } from`. No BC shims; rewrite callers.
- **Control flow:** guard-clause early returns; validators accumulate `const issues: ValidationIssue[] = []` + `push`, end in `buildResult` — never throw. Resource ops throw `FreshSqueezyError`.
- **Types:** `interface` for shapes, `type` for unions, `as const` for lookup tables (positioned top-of-file, after imports). `unknown` never `any`. One `FreshSqueezyError` (`code`/`status`); callers branch on `.code`. Single named return — no multi-object bags.
- **Layers:** strict `generated → core → resources → validate → cli`. `core/` imports only `core/` + `generated/` — never upward. `fetch` only in `core/http.ts`.
- **Validators:** rich ones (`product`/`discount`/`licenseKey`/`subscriptionPlan`) split a pure `check*(attributes)` from the fetch; thin ones stay fused. Error → issue mapping goes through `probeFetch`/`probeCollection` — no hand-rolled mapping, no silent `catch {}`.
- **Ops:** docs-backed only (`resourceRegistry` + `docsPath`). No inventing product/variant create. Nested client + CLI hybrid verbs via `invokeOp`.
- **Docs:** TSDoc why + `@param` + `@returns` + `@example` (+ `@throws` on ops). Agent skill: `skills/fresh-squeezy-ops/SKILL.md`.
- **Formatting:** Biome (`pnpm format` / `pnpm lint` / `pnpm check:ci`) — double quotes, semicolons, width 100, trailing commas. See `biome.json` (ADR-0001). Gate: `pnpm verify`.
- **CLI:** bare + TTY → action menu; flags/non-TTY defer, never hang; both call the same command functions. Exit `0`/`1`/`2`/`130`. Live/destructive ops need `--yes` or TTY confirm. After build: `pnpm cli` → `node dist/cli.js` (published bin).
- **Golden path (resource verb):** docs confirm → `resources/*` helper → registry → `invokeOp` + nested client → tests → `pnpm verify`.

Full guide with before/after: `CODE-STYLE.md`. Architecture decisions: `docs/adr/current/`.

## Repo layout

<!-- structure digest — full rationale in docs/adr/current/0005-repo-structure.md -->

- **`src/`** — all source. Unit tests are **colocated** as `*.test.ts` beside the module they cover. Layers import one-directionally: `generated → core → resources → validate → cli`. Build/CI scripts live in `src/scripts/` (`.mjs`, inert to the TS build).
- **`tests/`** — only what has no single owning module: `fixtures/`, `helpers/`, and `live/` (opt-in integration smoke). No unit tests here.
- **`public/`** — README/GitHub assets; **not** published to npm (`files` omits it).
- **Env** — one gitignored `.env`; `.env.example` carries only real secrets (the API key). Mode defaults to `test`; stores come from `--store-ids`.
- **No `bin/`** — the published binary is `dist/cli.js` (shebang added by tsup); `package.json` `bin` points straight at it.
