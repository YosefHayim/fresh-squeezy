# fresh-squeezy Plan

## Why

Lemon Squeezy has an official SDK, but getting from "API key in hand" to "integration is verified" still involves Postman, the dashboard, and manual ID checking. Every new product repeats the same setup work.

`fresh-squeezy` is a thin, validator-first toolkit that answers one question fast: **is my Lemon Squeezy setup actually correct, in the mode I think it is?**

It is not another full SDK. It is a setup doctor plus a minimal typed client plus an escape hatch.

## Scope

### In scope (v1)

- Typed client with one `request()` escape hatch
- Four validators: `connection`, `store`, `product`, `webhook`
- Single `doctor()` entrypoint that runs all four and returns a report
- Shared `ValidationResult` shape (stable public contract)
- Mode awareness (test vs live) surfaced in every result
- CLI built on `commander` + `inquirer` covering the same validators, in sandbox and live mode

### Out of scope (v1)

- License API client and validator (v2)
- Affiliates resource (v2)
- Changelog drift watcher — replaced with a static, reviewed `supportManifest.ts` (v2 if needed)
- Monorepo, codegen, plugins, dashboard UI

## Reuse contract (the integration story)

Other products should plug `fresh-squeezy` in with three lines and no custom glue. Two pieces must stay stable across releases:

1. The `ValidationResult` shape. Consumers wire it into their own CI, logs, or health dashboards.
2. The env variables it reads by default: `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, `LEMON_SQUEEZY_MODE`.

Target integration in a new product:

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const lemon = createFreshSqueezy(); // reads env
const report = await lemon.doctor();
if (!report.ok) process.exit(1);
```

## Public API

```ts
type ValidationSeverity = "info" | "warning" | "error";

type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  suggestedFix?: string;
  context?: Record<string, string | number | boolean | null>;
};

type ValidationResult<T = unknown> = {
  ok: boolean;
  mode: "test" | "live";
  resource?: T;
  issues: ValidationIssue[];
};

type DoctorReport = {
  ok: boolean;
  mode: "test" | "live";
  results: ValidationResult[];
};
```

Exports:

- `createFreshSqueezy(config?)`
- `FreshSqueezyError`
- `validateConnection`, `validateStore`, `validateProduct`, `validateWebhook`
- `doctor`
- `request`

## CLI design

The CLI is a thin shell over the library. Same validators, same result shape — no second implementation path.

### Libraries

- **commander**: subcommand routing, flags, help text. Chosen because it is the default for Node CLIs, has no runtime deps worth worrying about, and stays out of the way.
- **inquirer**: interactive prompts for guided mode. Chosen over `prompts` and `enquirer` for ecosystem maturity and predictable output formatting.
- **chalk**: colored output for pass/warn/fail.
- **ora**: spinner for async calls (optional, only if terminal is TTY).

Rationale is documented in `src/cli/README.md` so maintainers see the "why" next to the imports (per coding-standards §5).

### Modes

Every command accepts `--mode test|live`. Default is `test`. The mode flag governs which API base and which env vars apply:

| Flag          | API base                      | Env key override                      |
| ------------- | ----------------------------- | ------------------------------------- |
| `--mode test` | `https://api.lemonsqueezy.com` | `LEMON_SQUEEZY_API_KEY` (test key)    |
| `--mode live` | `https://api.lemonsqueezy.com` | `LEMON_SQUEEZY_API_KEY` (live key)    |

Note: Lemon Squeezy does not expose separate hosts for test vs live. Mode is enforced by which API key is used and is surfaced in every result's `mode` field so the user cannot confuse the two.

### Commands

```
fresh-squeezy doctor [--mode test|live] [--json]
fresh-squeezy validate connection [--mode test|live]
fresh-squeezy validate store --store-id <id> [--mode test|live]
fresh-squeezy validate product --product-id <id> [--mode test|live]
fresh-squeezy validate webhook --store-id <id> --url <url> [--mode test|live]
fresh-squeezy init        # interactive (inquirer): walks through env setup
```

### Interactive `init`

Guided path for first-time users. Prompts via `inquirer`:

1. API key (masked input)
2. Mode (test / live)
3. Detect stores → pick one
4. Offer to write `.env.local` (confirm before writing)
5. Run `doctor()` on the chosen config and print a summary

### Output

- Default: human-readable, colored.
- `--json`: emits a single `DoctorReport` object. Useful for CI.
- Exit code: `0` if `ok`, `1` if any `error` severity issue.

## Project structure

```
fresh-squeezy/
├── package.json
├── tsconfig.json
├── README.md
├── plan.md
├── bin/
│   └── fresh-squeezy.js        # shebang entry, imports dist/cli
├── src/
│   ├── index.ts                # public exports
│   ├── createFreshSqueezy.ts
│   ├── core/
│   │   ├── config.ts           # env loading, defaults
│   │   ├── errors.ts           # FreshSqueezyError
│   │   ├── http.ts             # request(), retries, pagination
│   │   └── types.ts            # ValidationResult, DoctorReport, etc.
│   ├── resources/
│   │   ├── users.ts
│   │   ├── stores.ts
│   │   ├── products.ts
│   │   ├── variants.ts
│   │   └── webhooks.ts
│   ├── validate/
│   │   ├── connection.ts
│   │   ├── store.ts
│   │   ├── product.ts
│   │   ├── webhook.ts
│   │   ├── doctor.ts           # composes the four above
│   │   └── rules.ts            # shared issue codes
│   ├── support/
│   │   └── manifest.ts         # known resources, fields, events
│   └── cli/
│       ├── index.ts            # commander program wiring
│       ├── commands/
│       │   ├── doctor.ts
│       │   ├── validate.ts
│       │   └── init.ts
│       ├── prompts.ts          # inquirer flows
│       ├── render.ts           # chalk formatting, table output
│       └── README.md           # CLI dep rationale
└── tests/
    ├── validate/
    ├── cli/
    └── fixtures/
        ├── sandbox/            # recorded test-mode responses
        └── live/               # redacted live-mode snapshots
```

## Phase 1 deliverables

Ship these, then stop and use it:

1. `package.json`, `tsconfig.json`, `bin/` entry
2. `core/http.ts` — `request()` with auth, mode header awareness, error normalization
3. `core/config.ts` — env loader with explicit precedence (flag > argument > env > default)
4. `validate/connection.ts` + `validate/store.ts` + `validate/product.ts` + `validate/webhook.ts`
5. `validate/doctor.ts` — composes the four
6. `cli/commands/doctor.ts` + `cli/commands/validate.ts` wired via `commander`
7. `cli/commands/init.ts` with `inquirer` flow
8. Tests: mode detection, auth failure, each validator against fixtures, CLI exit codes

## Testing strategy

Two tracks, both run in CI:

1. **Sandbox (test mode)**
   - Record real responses against a throwaway test-mode store once.
   - Replay via fixtures for unit tests — fast, deterministic.
   - `tests/fixtures/sandbox/` is the source of truth.

2. **Live (opt-in smoke)**
   - Single end-to-end test that runs `doctor()` against a real live key when `LEMON_SQUEEZY_LIVE_SMOKE=1`.
   - Skipped by default. Runs in a nightly workflow with a secret key.
   - Catches platform drift without blocking normal PRs.

Validator focus:

- wrong store / wrong product / unpublished product
- missing webhook events (including `customer_updated` added 2026-02-25)
- mode mismatch: live key pointed at a test store or vice versa
- JSON:API error shape normalization

## Dependencies

Runtime:

- `commander` — CLI routing
- `inquirer` — interactive prompts (CLI only; tree-shaken from library bundle)
- `chalk` — colored output
- `dotenv` — env loading for CLI

No HTTP library dependency — use `fetch` (Node 20+).

Dev:

- `typescript`, `tsup` (bundler), `vitest`, `@types/node`

Rationale for each non-trivial dep documented at the import site per coding-standards §5.

## Risks

1. **Mode confusion.** Test vs live is the easiest mistake. Mitigation: surface `mode` in every `ValidationResult`, refuse to proceed if detected mode differs from requested mode.
2. **JSON:API response drift.** Mitigation: normalize at `core/http.ts`, validate at boundary, snapshot-test fixtures.
3. **CLI scope creep.** Mitigation: CLI commands are 1:1 with library validators. No CLI-only logic.
4. **Support manifest rot.** Mitigation: one file, reviewed on each release, linked from changelog in README.

## Non-goals (pinned)

- No drift scraper in v1.
- No License API in v1.
- No monorepo.
- No plugin system.
- No dashboard.

If any of these come back as "nice to have," push to v2.
