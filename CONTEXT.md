# CONTEXT.md — fresh-squeezy

Orientation: what this is, its moving parts, and how they fit. For the words, see
`LANGUAGE.md`; for purpose and direction, `PROJECT.md`; for how to work in the repo, `AGENTS.md`.

## What it is

A CLI and TypeScript library that checks a Lemon Squeezy setup before it ships (the
**doctor**) and runs docs-backed **resource verbs** (ops). It is not an SDK to embed in
apps; product code uses the official SDK.

## Actors

- **Developer at a terminal** — opens the launcher menu or runs ops commands; confirms live and destructive writes.
- **CI runner or agent** — runs `doctor --json` and ops with flags and `--yes`; never waits on a prompt; reads exit codes 0, 1, 2, 130.
- **Library user** — calls `createFreshSqueezy()`: flat `validate*` functions and nested ops like `client.webhooks.create`; switches on `issue.code`.
- **Weekly drift workflow** — compares the changelog with the snapshot and opens an issue; never edits code.

## Shape

```
src/
  cli.ts                   the commander program
  create-fresh-squeezy.ts  the library client: validators, doctor(), lemon.<resource>.<verb>()
  augmentations.ts         SDK type augmentations
  app/                     one file per CLI command, the launcher menu, render, prompts
  features/
    validate/              one file per validator, the doctor run, issues, probe
    ops/                   the resource registry and invokeOp
    upkeep/                changelog drift and the API type generator
  shared/                  http, errors, config, contracts, attributes, support manifest, generated types
e2e/                       end-to-end tests, fakes, fixtures, opt-in live smoke
```

Imports point one way: `app/` to `features/` to `shared/`. Features never import each
other. `fetch` lives only in `shared/http.ts`.

## How the pieces relate

1. `createFreshSqueezy(config)` reads the env and builds one `HttpClient`.
2. A **validator** fetches through a **probe**, then runs its **check** over the attributes.
3. It returns a `ValidationResult` and never throws.
4. The **doctor** runs connection first, stops if it fails, then the rest, into a `DoctorReport`.
5. The CLI renders the report (text or `--json`) and exits with a stable code.

## Where to start reading

`src/cli.ts` for the CLI, `src/create-fresh-squeezy.ts` for the library, and
`src/features/validate/store.ts` for the smallest validator.
