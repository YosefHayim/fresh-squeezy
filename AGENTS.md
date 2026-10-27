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

- **Errors:** one `FreshSqueezyError` (a plain `Error` with `code`/`status`/`detail`), built by `freshSqueezyErrorOf`, checked with `isFreshSqueezyError`, never `instanceof`. Callers branch on `.code`. The client throws it; checks turn it into a finding and never re-throw. A function has one named return type, no multi-object bags.
- **Layers:** app root files (`cli.ts`, `print-report.ts`, `create-fresh-squeezy.ts`) -> `features/` -> `shared/`. Imports point one way; `shared/` imports nothing above it, and features never import each other. `fetch` only in `src/shared/http.ts`.
- **Checks:** each file in `features/validate/` holds one named list of `FindingRule` entries per check. `findingsFrom` runs the list, then `buildResult` ends the check. Fetches go through `fetchResource`, which maps every failed fetch to a finding in one place (a 401 is always `AUTH_FAILED`). No hand-rolled mapping, no silent `catch {}`. A check never throws.
- **Client:** `src/features/client/lemon-squeezy-client.ts` has one function per verb (`get`, `list`, `create`, `update`, `remove`, `cancelSubscription`, `refund`, `generateInvoice`, `currentUsage`). Types come from `src/shared/lemon-squeezy-types.ts`. Only calls the Lemon Squeezy docs list (docs.lemonsqueezy.com/api); never invent a write the API does not have. The license API is `license-api.ts`: no key, form fields.
- **Public API:** six `package.json` `exports` subpaths: `.`, `./config`, `./errors`, `./findings`, `./types`, `./license`. Each points at one file and has its own `tsup.config.ts` entry. No barrels. No compatibility shims: rewrite callers.
- **Scripts contract:** same names as the sibling repos: `dev`, `build`, `cli`, `test`, `test:watch`, `test:coverage`, `typecheck`, `lint`, `lint:fix`, `format`, `check:ci`, `check:standard`, `verify`. Variants nest with `:`. One `verify` gate (`check:ci`, `check:standard`, `typecheck`, `test`, `build`), never re-split. Local-only scripts go in `scripts/dev/`, which stays gitignored.
- **CLI:** `fresh-squeezy doctor` with flags only. It never prompts and never hangs. Exit codes `0` (ok), `1` (a check failed), `2` (usage or config error). After a build: `pnpm cli` runs `node dist/cli.js`.
- **CI and hooks:** CI runs the code standard check (Node 24, which code-standard needs), test and build. Lint, the code standard check and typecheck run in the husky pre-push hook, so a new worktree needs `pnpm install` before its first push.
- **Skill:** the agent skill lives in `skills/fresh-squeezy/SKILL.md`.

## Commands

```bash
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest, fixtures, no network
pnpm test:coverage      # thresholds 80/80/75/80
pnpm test:live          # live API smoke, needs LEMON_SQUEEZY_LIVE_SMOKE=1
pnpm build              # tsup, emits dist/
pnpm dev                # tsup --watch
pnpm check:standard     # code-standard check: health score and report link
pnpm verify             # biome ci + code standard + tsc + vitest + build (pre-PR gate)
```

Unit tests run against fixtures and sit next to their file as `<name>.test.ts`. End-to-end tests (the doctor CLI on a fake API) and the opt-in live smoke test live in `e2e/`.

## Recipes

### Add a check

1. Add the finding codes to `FINDING_CODES` in `src/features/validate/findings.ts`. They are public API, so keep them stable.
2. If the resource has no attributes type, add it to `src/shared/lemon-squeezy-types.ts`.
3. Add `src/features/validate/<name>.ts` with one named list of `FindingRule` entries. Fetch through `fetchResource`, run the list with `findingsFrom`, and end with `buildResult`.
4. Call it from `src/create-fresh-squeezy.ts`, and from `doctor` if it belongs in the default sweep.
5. Test the rules with plain fixtures and the fetch with the mock fetch from the existing tests. If it uses a new endpoint, extend the live smoke test in `e2e/`.
6. Add the doctor flag in `src/cli.ts` only if the check needs a new target. Update the README and `llms.txt`.

### When a changelog-drift issue opens

The `lemon-squeezy-changelog` workflow opens it on the 1st or 15th when the API changelog has a new entry. It never edits code.

1. Read the entry on docs.lemonsqueezy.com/api/getting-started/changelog.
2. Edit `src/shared/lemon-squeezy-types.ts` (attributes, create and update inputs) and `src/features/client/lemon-squeezy-client.ts` if a call changed or was added. Add only what the docs list.
3. Add a test next to the changed file. If a check should react to the change, add a finding rule.
4. Open a PR with `Closes #<issue>` and close the issue from it.

## Releasing

Releases are automatic. When a PR merges into `main`, the `Release` workflow bumps `package.json`, tags the commit and creates the GitHub release, then `Publish Package` publishes to npm.

- The bump is a patch by default. Add the `minor` or `major` label to the PR to change it.
- Add the `no-release` label to skip the release.

A nightly CI run smokes the live API with a test-mode key. Before a release, smoke the CLI by hand against a test-mode key: `npx fresh-squeezy doctor --all-resources`.

GitHub turns the `lemon-squeezy-changelog` schedule off after 60 days without activity in a public repo. Turn it back on with `gh workflow enable lemon-squeezy-changelog`.

## Commits

Short imperative subject, optional scope, optional body with the why. Examples: `fix(webhook): normalize trailing slashes when matching URLs`, `feat(client): add the affiliates resource`, `docs: replace the README`. Decisions go in the PR description.

## Repo layout

- **`src/`**: all source. Unit tests sit beside the module they cover. Root files: `cli.ts`, `print-report.ts`, `create-fresh-squeezy.ts`. `features/client/` holds the client and the license API, `features/validate/` holds one file per check plus `doctor.ts`, `findings.ts` and `fetch-resource.ts`, `shared/` holds `config.ts`, `http.ts`, `errors.ts` and `lemon-squeezy-types.ts`.
- **`e2e/`**: the doctor CLI end-to-end tests on a fake API, the opt-in live smoke test, and their helpers and fixtures.
- **`skills/fresh-squeezy/`**: the agent skill.
- **`public/`**: README and GitHub assets, not published to npm.
- **Env**: one gitignored env file; the example env file carries only the real secret (the API key). Mode defaults to `test`; stores come from `--store-id`.
- **No `bin/`**: the published binary is `dist/cli.js` (shebang added by tsup).
