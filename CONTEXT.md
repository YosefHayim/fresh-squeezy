# CONTEXT.md

Orientation for fresh-squeezy — what it is, who touches it, and the shape of the code. Not
a glossary (that's `LANGUAGE.md`) and not the rules (that's `AGENTS.md`).

## What it is

A dual-mode **ops + doctor** tool for Lemon Squeezy: pre-flight validation (stores,
products, webhooks, discounts, license keys, plans, mode) **and** docs-backed resource
operations (get/list/create/update/delete/cancel/refund/… only where the official API
documents them). Catalog objects (products/variants/prices/files/stores) are **read-only**
in the API. It is not an app-embedding SDK — use the official SDK in product code. Ships
as CLI (`npx fresh-squeezy`) and TypeScript library.

## Actors

- **Developer at a terminal** — bare TTY menu (doctor / init / …); hybrid ops
  (`get|list|create|… <resource>`); prompts for confirms on destructive/live writes.
- **CI runner / agent** — `doctor --json` and ops with flags + `--yes`; never hangs;
  exit codes 0/1/2/130.
- **Library consumer** — `createFreshSqueezy()`: flat `validate*` + nested ops
  (`client.webhooks.create`, `client.products.get`); switch on `issue.code` for doctor.
- **The weekly drift workflow** — changelog snapshot + proposed ops gaps; never edits
  runtime code automatically.

## Shape

Layer-based, strict one-directional imports (`generated → contracts, errors, shared, http →
resources → validate → cli`):

```
generated/        auto-generated Lemon Squeezy attribute types
http/             HttpClient (the one I/O chokepoint)
errors/           FreshSqueezyError (plain Error + fields)
shared/           env and config resolution (the only place that reads the environment)
contracts/        shared public types (ValidationResult, DoctorReport, config, JSON:API)
resources/        registry.ts (one table of docs-backed ops + invokeOp) + attributes.ts
support/          static manifest (webhook policy, acknowledged changelog) + drift snapshot
validate/         doctor validators — check*/validate* + composition + issues/probe
skills/           agent SKILL.md for ops+doctor usage
augmentations.ts  isolated .d.ts helpers for SDK users (imports only generated/)
cli/              commander + @inquirer/prompts shell over the library
scripts/          build/CI tooling (.mjs) — changelog drift + API-type generation
(no index.ts, no barrels: each public module is a package.json exports subpath, see tsup.config.ts)
```

## Core flow

1. `createFreshSqueezy(config)` resolves env + builds one `HttpClient`.
2. A validator fetches through `probeFetch`/`probeCollection` (the only place a network
   throw is caught), then runs pure `check*` assertions over the returned attributes.
3. It returns a `ValidationResult` — never throws — with `ok` derived from issue severity.
4. `doctor()` composes validators: connection first (short-circuits on failure), then the
   rest, into a `DoctorReport`.
5. The CLI renders the report (human or `--json`) and exits with a stable code.

## Boundaries / non-goals

Validator-first (no passthroughs that hide HTTP calls); one HTTP layer; stable
`ValidationResult` / `issue.code` shape (breaking = major bump); mode-awareness on every
result; static support manifest + drift snapshot (no live changelog scraping at runtime).
See `PROJECT.md` for direction.

## Recipes

### Add a validator

1. If the resource has no `*Attributes` in `src/resources/attributes.ts`, add one (`extends Generated*Attributes`).
2. Add issue codes to `ISSUE_CODES` in `src/validate/issues.ts` (stable public API).
3. Add `src/validate/<name>.ts`. Rich logic: extract a pure `check<Name>(attributes): ValidationIssue[]`; fetch with `http.getResource` / `http.paginate` inside `probeFetch` / `probeCollection`; build with `buildResult`.
4. Add its subpath: an `exports` entry in `package.json` (`./validate/<name>`) and an entry in `tsup.config.ts`.
5. Unit-test the pure `check<Name>` with plain fixtures (`e2e/fixtures/sandbox/data.ts`); test the async validator with `makeClient` and `createMockFetch`. If it talks to a new endpoint, extend the live smoke test in `e2e/`.
6. Wire it into `doctor()` if it belongs in the default sweep.
7. Add a `VALIDATE_SUBCOMMANDS` row in `src/cli/commands/validate.ts` (`fresh-squeezy validate <name>`). If `init` or `doctor --all-resources` should discover it, add an `OPTIONAL_VALIDATORS` row in `src/cli/optional-validators.ts`.
8. Update the README table.

### Add a CLI command

1. Add the handler in `src/cli/commands/<verb>.ts` as `run<Verb>Command(options)` returning an exit code.
2. Register it on `program` in `src/cli/main.ts` with commander flags.
3. Keep the dual-mode contract: flags or no TTY never hang; the interactive path prompts with `@inquirer/prompts`; both routes call the same `run<Verb>Command`.
4. Add the verb to the bare-invocation menu (`pickLauncherAction`).
5. Render through `src/cli/render.ts` and support `--json`.

### Add a resource verb

Confirm it in the docs, add the verb to the resource's `RESOURCES` row (plus `*Attributes` in `resources/attributes.ts` for a new resource), add the nested client method, add a row to `create-fresh-squeezy.test.ts`, run `pnpm verify`.

## Exemplars

```ts
// Validators accumulate issues, return early on a failed fetch, end in buildResult (src/validate/store.ts)
const issues: ValidationIssue[] = [];
if (!fetched.ok) {
  issues.push(fetched.issue);
  return buildResult<StoreAttributes>("store", mode, issues, undefined, target);
}
return buildResult("store", mode, issues, fetched.resource.attributes, target);

// Rich validator: pure check, thin fetch (src/validate/product.ts)
export const checkProduct = (attrs: ProductAttributes, storeId?: string): ValidationIssue[] => {};

// Collection fetch through the probe wrapper (src/validate/webhook.ts)
const probed = await probeCollection(() =>
  http.paginate<WebhookAttributes>("/v1/webhooks", { "filter[store_id]": String(storeId) }),
);

// One table per list: a row per resource, per validate subcommand, per optional validator
["webhook", ["get", "list", "create", "update", "delete"], "store"],
```
