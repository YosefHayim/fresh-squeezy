# ADR-0005: Repo structure — colocation, single env, no bin shim

## Status

Accepted — 2026-07-02

## Context

Several structural conventions no longer earned their keep:

- Unit tests lived in a parallel `tests/` tree mirroring `src/`, so every test sat two
  directories from the module it covered (`tests/validate/store.test.ts` ↔
  `src/validate/store.ts`).
- `bin/fresh-squeezy.js` was a two-line shim (`import "../dist/cli.js"`) even though `tsup`
  already emits `dist/cli.js` with a `#!/usr/bin/env node` banner.
- Build/CI scripts sat in a top-level `scripts/` beside `src/`.
- The hero image lived in `assets/` and shipped inside the npm tarball (`files`) — 101 KB of
  README art in every install.
- Three local env files (`.env.local`, `.env.test.local`, `.env.live.local`) — two of them
  dead (nothing loaded them; their `LS_*` keys never matched the code's `LEMON_SQUEEZY_*`
  vars) — plus an `.env.example` that documented non-secret config (`MODE`, a smoke flag).

## Decision

1. **Colocate unit tests.** Each `*.test.ts` sits beside its module under `src/`. `tests/`
   keeps only what has no single owning module: `fixtures/`, `helpers/`, and `live/` (opt-in
   integration smoke). Colocated tests import shared helpers cross-tree
   (`../../tests/helpers/…`). Typecheck scope is preserved: tsconfig `exclude` is
   `**/*.test.ts`, so `tsc --noEmit` covers the same source it always did; vitest collects
   `src/**/*.test.ts`; coverage excludes `**/*.test.ts`.
2. **No `bin/`.** `package.json` `bin` points straight at `./dist/cli.js`; the shim is gone.
3. **Scripts under `src/scripts/`.** The `.mjs` build scripts move in; their `repoRoot`
   resolves one level deeper (`resolve(dirname(thisFile), "../..")`). `.mjs` is inert to the
   TS build (no `allowJs`).
4. **`public/` at the root, unshipped.** `assets/` → `public/`; removed from `files` so the
   hero no longer ships to npm. It stays tracked for GitHub/README rendering.
5. **One `.env`.** The dead `.local` files are deleted; `.env.local` → `.env`; the CLI loads
   a single `.env`; `init` writes `.env`. `.env.example` carries only the one true secret
   (`LEMON_SQUEEZY_API_KEY`) — `MODE` defaults to `test` in code, stores come from
   `--store-ids`.

## Consequences

- A module and its test move, rename, and review together; the mirror tree is gone.
- The published package is smaller (no `bin/`, no hero) and the binary path is direct.
- One env file, one template; the template leaks no non-secret config. Running the opt-in
  live smoke means pointing `.env` at a live-mode key.
- Not adopted: moving `helpers/`/`fixtures/` into `src/test-support/` (would keep unit-test
  deps inside `src/`, but the owner chose to keep the shared support under `tests/`).
