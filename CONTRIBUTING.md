# Contributing

Thanks for looking. `fresh-squeezy` aims to stay small and boring — contributions that keep it that way are the easiest to land.

## Prerequisites

- Node.js **20+** (the library uses the native `fetch` global)
- npm (the repo uses a single lockfile; don't introduce pnpm/yarn/bun unless the change is repo-wide)

## Local setup

```bash
git clone https://github.com/YosefHayim/fresh-squeezy.git
cd fresh-squeezy
npm install
cp .env.example .env.local   # fill in your key (test or live) if you want to run the CLI
```

## Common commands

```bash
npm run typecheck          # tsc --noEmit, must be clean
npm run test               # vitest unit tests (fixtures, no network)
npm run test:coverage      # thresholds: 80/80/75/80
npm run test:live          # opt-in live API smoke, needs LEMON_SQUEEZY_LIVE_SMOKE=1
npm run build              # tsup — emits dist/
npm run dev                # tsup --watch
npm run check:changelog    # diff Lemon Squeezy changelog vs committed snapshot
```

## Project layout

```
src/
  core/        transport, config, errors, shared types
  resources/   thin JSON:API wrappers (users, stores, products, variants, webhooks)
  validate/    validators + doctor composition (the actual product)
  support/     locally reviewed manifest of what fresh-squeezy understands
               + changelog-snapshot.json (drift baseline)
  cli/         commander + inquirer shell over the library
scripts/
  check-changelog.mjs      drift detector used by the weekly workflow
tests/
  core/        unit tests for http + config
  validate/    unit tests for each validator + doctor
  cli/         CLI command unit tests (stubbed fetch)
  fixtures/    canned JSON:API responses from a test-mode store
  live/        opt-in live smoke (LEMON_SQUEEZY_LIVE_SMOKE=1)
  helpers/     mockFetch helper
```

## Design guardrails

Read `plan.md` first — it documents the non-goals as strongly as the goals. In short:

1. **Validator-first.** New endpoints should land as validators, not as passthroughs that hide HTTP calls.
2. **One HTTP layer.** Everything goes through `src/core/http.ts` for auth, error normalization, and retry behavior.
3. **Stable `ValidationResult` shape.** Consumers switch on `issue.code`. Breaking changes to shape or codes require a major version bump.
4. **Mode awareness everywhere.** Every validator surfaces `mode` so CI can detect test/live confusion.
5. **Static support manifest + drift snapshot.** No live changelog scraping inside runtime code. When the weekly drift workflow opens an issue, update `src/support/manifest.ts` and refresh the snapshot.

## Adding a validator

1. If the platform resource isn't in `src/resources/`, add a thin file there first — attributes type + a `getX` / `listX` helper.
2. Add the validator in `src/validate/<name>.ts`. Use `rules.ts` helpers so the result shape stays identical.
3. Add issue codes to `ISSUE_CODES` in `rules.ts`. Treat them as stable public API.
4. Add unit tests in `tests/validate/<name>.test.ts` using fixtures from `tests/fixtures/sandbox/data.ts`.
5. Wire it into `doctor()` if it belongs in the default health check.
6. Mirror the validator as a `fresh-squeezy validate <name>` CLI subcommand in `src/cli/main.ts`.
7. Update the README table.

## Responding to a changelog-drift issue

When the weekly `changelog-drift` workflow opens an issue:

1. Open the Lemon Squeezy changelog URL from the issue body.
2. Read the new entries. For each one, decide:
   - **New webhook event we should recommend?** → add to `RECOMMENDED_WEBHOOK_EVENTS` in `src/support/manifest.ts`.
   - **New webhook event but integration-specific?** → add to `OPTIONAL_WEBHOOK_EVENTS`.
   - **New resource / attribute we don't validate yet?** → add a row to `ACKNOWLEDGED_CHANGELOG_ENTRIES` explaining why it's not wrapped.
3. Update the JSDoc block above each list with the date + link.
4. Refresh the snapshot so future runs start from the new baseline:
   ```
   npm run check:changelog -- --update
   ```
5. Commit both `src/support/manifest.ts` and `src/support/changelog-snapshot.json` in the same PR. Close the issue on merge.

The drift workflow is advisory — it never modifies code automatically. The snapshot file is small (~200 bytes) and safe to diff in reviews.

## Testing

- **Unit tests** run against recorded fixtures. Fast, deterministic, run on every push. Coverage threshold is 80% lines / 80% functions / 75% branches.
- **Live smoke tests** run nightly in CI against a secret test-mode key. If you add a validator that talks to a new endpoint, extend `tests/live/smoke.test.ts` so drift is caught before the next release.
- **Changelog drift** runs weekly (Monday 06:00 UTC). See above.
- Manual QA steps for humans before a release: `docs/MANUAL_QA.md`.

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
2. If `src/support/manifest.ts` changed, refresh the snapshot with `npm run check:changelog -- --update`.
3. Tag the release: `git tag vX.Y.Z && git push --tags`. The `release` workflow publishes to npm using `NPM_TOKEN`.

## Filing issues

Please include:

- `fresh-squeezy` version
- Node version
- Mode (`test` or `live`)
- The minimal reproduction — a 5-line script is best
- The full `ValidationResult` or `DoctorReport` JSON (redact `apiKey`)

## Code of conduct

Be kind. Assume good intent. Ship boring code.
