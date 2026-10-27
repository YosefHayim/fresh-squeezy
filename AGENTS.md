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

Unit tests run against fixtures and are colocated as `<name>.test.ts`. End-to-end tests and the opt-in live smoke test live in `e2e/`. Recipes for adding a validator, a CLI command or a resource verb are in `CONTEXT.md`.

## Commits

Short imperative subject, optional scope, optional body with the why. Examples: `fix(webhook): normalize trailing slashes when matching URLs`, `feat(product): add variant/price consistency check`, `chore(manifest): add customer_updated event`. Decisions go in the PR description.

## Repo layout

- **`src/`**: all source. Unit tests sit beside the module they cover. `app/` is the CLI (one file per command, named `<name>-command.ts`), `features/` holds `validate/`, `ops/` and `upkeep/` (build and CI scripts, `.mjs`, inert to the TS build), `shared/` holds what several parts use (http, errors, config, contracts, attributes, generated API types, support manifest). Entry files: `src/cli.ts`, `src/create-fresh-squeezy.ts`, `src/augmentations.ts`.
- **`e2e/`**: the end-to-end tests, the opt-in live smoke test, and their helpers and fixtures.
- **`public/`**: README and GitHub assets, not published to npm.
- **Env**: one gitignored env file; the example env file carries only the real secret (the API key). Mode defaults to `test`; stores come from `--store-ids`.
- **No `bin/`**: the published binary is `dist/cli.js` (shebang added by tsup).
