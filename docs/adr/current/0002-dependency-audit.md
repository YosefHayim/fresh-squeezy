# ADR-0002: Dependency audit — drop ora, migrate inquirer

## Status

Accepted — 2026-07-02

## Context

`ora` ^8 was a declared dependency with zero imports across `src/`, `scripts/`, and `bin/`
— dead weight. `inquirer` ^10 was used via its legacy monolithic
`inquirer.prompt([{ type, name, … }])` array API at 10 sites in `src/cli/prompts.ts`, with
a separate `@types/inquirer` devDependency. The maintained path is `@inquirer/prompts`
(modular `select` / `checkbox` / `password` / `confirm` functions that ship their own
types). `chalk`, `commander`, and `dotenv` are all healthy and were kept.

## Decision

- Remove `ora`.
- Migrate `inquirer` → `@inquirer/prompts`; rewrite the 10 prompt sites from the array API
  to the modular functions.
- Drop `@types/inquirer` (types are now first-party).

## Consequences

- Leaner dependency tree on the maintained API.
- `src/cli/prompts.ts` and its tests are rewritten (follow-on code work); no behavior
  change to the CLI's prompts is intended.
- Removing `ora` and swapping `inquirer` are applied together with a single `npm install`
  to keep the lockfile in sync (the same install that adds `@biomejs/biome`).
