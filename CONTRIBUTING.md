# Contributing

Thanks for looking. `fresh-squeezy` aims to stay small and boring — contributions that keep it that way are the easiest to land.

## Prerequisites

- Node.js **20+** (the library uses the native `fetch` global)
- **pnpm** (repo `packageManager` is `pnpm@10`; use Corepack or install pnpm 10 — don't introduce npm/yarn/bun lockfiles)

## Local setup

```bash
git clone https://github.com/YosefHayim/fresh-squeezy.git
cd fresh-squeezy
pnpm install
cp .env.example .env   # fill in your key if you want to run the CLI
```

## Common commands

```bash
pnpm typecheck          # tsc --noEmit, must be clean
pnpm test               # vitest unit tests (fixtures, no network)
pnpm test:coverage      # thresholds: 80/80/75/80
pnpm test:live          # opt-in live API smoke, needs LEMON_SQUEEZY_LIVE_SMOKE=1
pnpm build              # tsup — emits dist/
pnpm dev                # tsup --watch
pnpm check:changelog    # diff Lemon Squeezy changelog vs committed snapshot
pnpm verify             # biome ci + tsc + vitest + build (pre-PR gate)
```

## Project layout

```
src/
  core/        transport, config, errors, shared types
  resources/   thin JSON:API wrappers (users, stores, products, variants, webhooks)
  validate/    validators + doctor composition (the actual product)
  support/     locally reviewed manifest + changelog-snapshot.json (drift baseline)
  cli/         commander + @inquirer/prompts shell over the library
  scripts/     build/CI scripts (changelog drift, API-type generation)
  *.test.ts    unit tests colocated beside the module they cover
tests/
  fixtures/    canned JSON:API responses from a test-mode store
  helpers/     mockFetch + fake validators
  live/        opt-in live smoke (LEMON_SQUEEZY_LIVE_SMOKE=1)
```

## Design guardrails

Read `PROJECT.md` first — it documents the non-goals as strongly as the goals. In short:

1. **Validator-first.** New endpoints should land as validators, not as passthroughs that hide HTTP calls.
2. **One HTTP layer.** Everything goes through `src/core/http.ts` for auth, error normalization, and retry behavior.
3. **Stable `ValidationResult` shape.** Consumers switch on `issue.code`. Breaking changes to shape or codes require a major version bump.
4. **Mode awareness everywhere.** Every validator surfaces `mode` so CI can detect test/live confusion.
5. **Static support manifest + drift snapshot.** No live changelog scraping inside runtime code. When the weekly drift workflow opens an issue, update `src/support/manifest.ts` and refresh the snapshot.

## Adding a validator

1. If the platform resource isn't in `src/resources/`, add a thin file there first — attributes type + a `getX` / `listX` helper.
2. Add the validator in `src/validate/<name>.ts`. Use `rules.ts` helpers so the result shape stays identical.
3. Add issue codes to `ISSUE_CODES` in `rules.ts`. Treat them as stable public API.
4. Add a colocated unit test `src/validate/<name>.test.ts` using fixtures from `tests/fixtures/sandbox/data.ts`.
5. Wire it into `doctor()` if it belongs in the default health check.
6. Mirror the validator as a `fresh-squeezy validate <name>` CLI subcommand in `src/cli/main.ts`.
7. Update the README table.

## Responding to a changelog-drift issue

When the weekly `changelog-drift` workflow opens an issue:

1. **Read the "New entries" section.** The issue body includes a structured diff listing each new changelog entry with its date, heading, and a body excerpt.
2. **For each entry, decide:** codify as a check, document as acknowledged, or skip.
   - **Codify:** Add a validator or wire an existing one to cover the new platform behavior.
   - **Acknowledge:** The entry is known but out of scope — document it below.
   - **Skip:** Purely cosmetic or irrelevant changes (typo fixes, branding).
3. **If codifying or acknowledging:** add a row to `ACKNOWLEDGED_CHANGELOG_ENTRIES` in `src/support/manifest.ts` with the entry's date, a one-line summary, and the action taken (e.g. which validator handles it, or why it's intentionally unwrapped). If codifying, also wire the actual check in `src/validate/`.
4. **Refresh the snapshot** so future runs start from the new baseline:
   ```
   pnpm check:changelog -- --update
   ```
5. **Open a PR** titled `chore(changelog): adopt YYYY-MM-DD entries`. Include both `src/support/manifest.ts` and `src/support/changelog-snapshot.json`. Close the drift issue from the PR (e.g. `Closes #123` in the description).

The drift workflow is advisory — it never modifies code automatically. The snapshot file is small and safe to diff in reviews.

## Testing

- **Unit tests** run against recorded fixtures. Fast, deterministic, run on every push. Coverage threshold is 80% lines / 80% functions / 75% branches.
- **Live smoke tests** run nightly in CI against a secret test-mode key. If you add a validator that talks to a new endpoint, extend `tests/live/smoke.test.ts` so drift is caught before the next release.
- **Changelog drift** runs weekly (Monday 06:00 UTC). See above.
- Before a release, smoke the CLI by hand against a test-mode key: `npx fresh-squeezy` (guided setup) and `fresh-squeezy doctor --all-stores`. See `docs/cli-reference.md`.

## Commit style

Short, imperative subject, optional scope, optional body with the *why*. Examples:

```
fix(webhook): normalize trailing slashes when matching URLs
feat(product): add variant/price consistency check
docs(readme): document --mode flag precedence
chore(manifest): add customer_updated event (changelog 2026-02-25)
```

## Releasing

1. Bump `version` in `package.json` following semver.
2. If `src/support/manifest.ts` changed, refresh the snapshot with `pnpm check:changelog -- --update`.
3. Tag the release: `git tag vX.Y.Z && git push --tags`. The `release` workflow publishes to the npm registry using `NPM_TOKEN`.

## Filing issues

Please include:

- `fresh-squeezy` version
- Node version
- Mode (`test` or `live`)
- The minimal reproduction — a 5-line script is best
- The full `ValidationResult` or `DoctorReport` JSON (redact `apiKey`)

## Code of conduct

Be kind. Assume good intent. Ship boring code.
