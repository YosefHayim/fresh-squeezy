# CONTEXT.md — fresh-squeezy

Orientation: what this is, its moving parts, and how they fit. For the words, see
`LANGUAGE.md`; for purpose and direction, `PROJECT.md`; for how to work in the repo, `AGENTS.md`.

## What it is

The up-to-date Lemon Squeezy **client** for TypeScript, which replaces
`@lemonsqueezy/lemonsqueezy.js`, plus a **doctor** that runs seven checks on a store
before it ships. Zero runtime dependencies, Node 22+.

## Actors

- **Developer or agent in app code** — calls `createFreshSqueezy()`: `get`, `list`, `create`, `update`, `remove` and friends, plus `fresh-squeezy/license` for the keyless license API.
- **CI runner or agent** — runs `fresh-squeezy doctor --json` with flags only; never waits on a prompt; reads exit codes 0, 1, 2 and `findings[].code`.
- **Library user of the checks** — calls `validate*` or `doctor()` and switches on `finding.code`.
- **Changelog workflow** — on the 1st and 15th it opens a `changelog-drift` issue when the API changelog has a new entry; never edits code.

## Shape

```
src/
  cli.ts                     fresh-squeezy doctor, flags only
  print-report.ts            the doctor text output
  create-fresh-squeezy.ts    the library entry: config, http, client and checks on one object
  features/
    client/                  lemon-squeezy-client.ts, license-api.ts
    validate/                one file per check, doctor, findings, fetch-resource
  shared/                    config, http, errors, lemon-squeezy-types
e2e/                         doctor CLI on a fake API, opt-in live smoke
skills/fresh-squeezy/        the agent skill
```

Imports point one way: app root files to `features/` to `shared/`. Features never import
each other. `fetch` lives only in `shared/http.ts`.

## How the pieces relate

1. `createFreshSqueezy(config)` reads the env and builds one `Http`.
2. The **client** turns each call into one documented request; its types come from `lemon-squeezy-types.ts`.
3. A **check** fetches through `fetchResource`, runs its **finding rules**, and returns a `ValidationResult`. It never throws.
4. The **doctor** runs connection first, stops if it fails, then the rest, into a `DoctorReport`.
5. The CLI prints the reports (text or `--json`) and exits 0, 1 or 2.

## Where to start reading

`src/cli.ts` for the CLI, `src/create-fresh-squeezy.ts` for the library, and
`src/features/validate/store.ts` for the smallest check.
