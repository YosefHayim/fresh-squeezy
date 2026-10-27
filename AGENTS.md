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

Code standard: read node_modules/code-standard/README.md before you write code.

Rules only this repo has:

- **Errors:** one `FreshSqueezyError` (a plain `Error` with `code`/`status`/`detail`), built by `freshSqueezyErrorOf`, checked with `isFreshSqueezyError`, never `instanceof`. Callers branch on `.code`. Resource ops throw it; validators turn it into an issue and never re-throw. A function has one named return type, no multi-object bags.
- **Layers:** strict `app/ -> features/ -> shared/`. Imports point one way; `shared/` imports nothing above it, and features never import each other. `fetch` only in `src/shared/http.ts`.
- **Validators:** rich ones (`product`, `discount`, `license-key`, `subscription-plan`) split a pure `check*(attributes)` from the fetch; thin ones stay fused. Error to issue mapping goes through `probeFetch` / `probeCollection`: no hand-rolled mapping, no silent `catch {}` (a best-effort skip gets a one-line why comment or an info issue). Validators accumulate `const issues: ValidationIssue[] = []` with `push` and end in `buildResult`; they never throw.
- **Ops:** docs-backed only (docs.lemonsqueezy.com/api). `src/features/ops/resource-registry.ts` holds one `RESOURCES` row per resource; `VERB_RULES` maps each verb to one HTTP call and a docs slug, from which `docsPath` is built (`DOCS_PATH_EXCEPTIONS` lists the pages that break the pattern). Never invent product, variant or price writes. CLI verbs and the nested client both call `invokeOp`.
- **Tables:** one table per repeated list (`RESOURCES`, `VALIDATE_SUBCOMMANDS`, `OPTIONAL_VALIDATORS`). Add a row, do not re-list in other files.
- **Public API:** no barrels. Each public module is its own `package.json` `exports` subpath and its own `tsup.config.ts` entry; the entry keys are the public subpath names. `fresh-squeezy` itself exports only `createFreshSqueezy`. No compatibility shims: rewrite callers.
- **Scripts contract:** same names as the sibling repos: `dev`, `build`, `cli`, `test`, `test:watch`, `test:coverage`, `typecheck`, `lint`, `lint:fix`, `format`, `check:ci`, `check:standard`, `verify`. Variants nest with `:`. One `verify` gate (`check:ci`, `check:standard`, `typecheck`, `test`, `build`), never re-split. Local-only scripts go in `scripts/dev/`, which stays gitignored.
- **CLI:** bare command in a TTY opens the action menu; flags or no TTY never prompt and never hang; both routes call the same command function. Exit codes `0`, `1`, `2`, `130`. Live or destructive ops need `--yes` or a TTY confirm; `--all` / `--ids` bulk ops confirm once and exit `1` on partial failure. After a build: `pnpm cli` runs `node dist/cli.js`.
- **CI and hooks:** CI runs the code standard check (Node 24, which code-standard needs), test and build. Lint, the code standard check, the API-types check and typecheck run in the husky pre-push hook, so a new worktree needs `pnpm install` before its first push.
- **Skill:** the agent skill lives in `skills/fresh-squeezy-ops/SKILL.md`.

## Commands

```bash
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest, fixtures, no network
pnpm test:coverage      # thresholds 80/80/75/80
pnpm test:live          # live API smoke, needs LEMON_SQUEEZY_LIVE_SMOKE=1
pnpm build              # tsup, emits dist/
pnpm dev                # tsup --watch
pnpm check:changelog    # diff the Lemon Squeezy changelog against the snapshot
pnpm check:standard     # code-standard check: health score and report link
pnpm verify             # biome ci + code standard + tsc + vitest + build (pre-PR gate)
```

Unit tests run against fixtures and are colocated as `<name>.test.ts`. End-to-end tests and the opt-in live smoke test live in `e2e/`. Recipes for adding a validator, a CLI command or a resource verb are in the Recipes section below.

## Recipes

### Add a validator

1. If the resource has no `*Attributes` in `src/shared/attributes.ts`, add one (`extends Generated*Attributes`).
2. Add issue codes to `ISSUE_CODES` in `src/features/validate/issues.ts`. They are public API, so keep them stable.
3. Add `src/features/validate/<name>.ts`. For rich logic, write a pure `check<Name>(attributes): ValidationIssue[]`. Fetch with `http.getResource` or `http.paginate` inside `probeFetch` or `probeCollection`, and build the result with `buildResult`.
4. Add its subpath: an `exports` entry in `package.json` (`./validate/<name>`) and an entry in `tsup.config.ts`.
5. Unit-test the pure `check<Name>` with plain fixtures (`e2e/fixtures/sandbox/data.ts`). Test the async validator with `makeClient` and `createMockFetch`. If it uses a new endpoint, extend the live smoke test in `e2e/`.
6. Wire it into `doctor()` if it belongs in the default sweep.
7. Add a `VALIDATE_SUBCOMMANDS` row in `src/app/validate-command.ts` (`fresh-squeezy validate <name>`). If `init` or `doctor --all-resources` should find it, add an `OPTIONAL_VALIDATORS` row in `src/app/optional-validators.ts`.
8. Update the README table.

### Add a CLI command

1. Add the handler in `src/app/<name>-command.ts` as `run<Verb>Command(options)` that returns an exit code.
2. Register it on `program` in `src/cli.ts` with its commander flags.
3. Keep the dual-mode contract: flags or no TTY never hang, the interactive path prompts with `@inquirer/prompts`, and both routes call the same `run<Verb>Command`.
4. Add the verb to the bare-invocation menu (`pickLauncherAction` in `src/app/launcher-menu.ts`).
5. Render through `src/app/render.ts` and support `--json`.

### Add a resource verb

Confirm the verb in the official docs. Add it to the resource's `RESOURCES` row in `src/features/ops/resource-registry.ts` (and a `*Attributes` in `src/shared/attributes.ts` for a new resource). Add the nested client method, add a row to `create-fresh-squeezy.test.ts`, and run `pnpm verify`.

## Releasing

Releases are automatic. When a PR merges into `main`, the `Release` workflow bumps `package.json`, tags the commit and creates the GitHub release, then `Publish Package` publishes to npm.

- The bump is a patch by default. Add the `minor` or `major` label to the PR to change it.
- Add the `no-release` label to skip the release.
- If `src/shared/support-manifest.ts` changed, refresh the snapshot with `pnpm check:changelog -- --update` in the same PR.

A nightly CI run smokes the live API with a test-mode key. Before a release, smoke the CLI by hand against a test-mode key: `npx fresh-squeezy` and `fresh-squeezy doctor --all-stores`.

## Changelog drift

The weekly `changelog-drift` workflow (Monday 06:00 UTC) opens an issue when the Lemon Squeezy changelog moves. It is advisory and never edits code.

1. Read the "New entries" section of the issue: each entry has a date, heading and body excerpt.
2. Decide per entry: codify as a check, or skip if out of scope or cosmetic.
3. To codify, add new webhook events to `src/shared/support-manifest.ts` and wire the check in `src/features/validate/`.
4. Refresh the snapshot so future runs start from the new baseline: `pnpm check:changelog -- --update`.
5. Open a PR titled `chore(changelog): adopt YYYY-MM-DD entries` with `src/features/upkeep/changelog-snapshot.json` (and `src/shared/support-manifest.ts` if it changed), and close the drift issue from it (`Closes #123`).

## Commits

Short imperative subject, optional scope, optional body with the why. Examples: `fix(webhook): normalize trailing slashes when matching URLs`, `feat(product): add variant/price consistency check`, `chore(manifest): add customer_updated event`. Decisions go in the PR description.

## Repo layout

- **`src/`**: all source. Unit tests sit beside the module they cover. `app/` is the CLI (one file per command, named `<name>-command.ts`), `features/` holds `validate/`, `ops/` and `upkeep/` (build and CI scripts, `.mjs`, inert to the TS build), `shared/` holds what several parts use (http, errors, config, contracts, attributes, generated API types, support manifest). Entry files: `src/cli.ts`, `src/create-fresh-squeezy.ts`, `src/augmentations.ts`.
- **`e2e/`**: the end-to-end tests, the opt-in live smoke test, and their helpers and fixtures.
- **`public/`**: README and GitHub assets, not published to npm.
- **Env**: one gitignored env file; the example env file carries only the real secret (the API key). Mode defaults to `test`; stores come from `--store-ids`.
- **No `bin/`**: the published binary is `dist/cli.js` (shebang added by tsup).
