# ADR-0007: Bulk flags on destructive ops

Status: accepted

## Context

`delete`, `cancel`, and `refund` took one `--id`, so clearing a store of discounts or webhooks meant a shell loop around the CLI. Extends [ADR-0006](./0006-docs-backed-ops-cli.md).

## Decision

- `--all`, `--ids`, `--match`, and `--dry-run` are registered on every op verb but only accepted where the registry marks the op `destructive` with `idRole: "id"`. Anything else exits `2` before any network call.
- `--all` reuses the resource's registered `list` op (all pages) and its scope rules (`--store-ids` / `--parent-id`). `--match` filters client-side because the API has no text filter.
- One confirm per batch with count and labels; non-TTY needs `--yes`. `--dry-run` never writes and never prompts.
- Per-item errors do not abort the batch. The JSON envelope keeps `ok/mode/resource/verb/docs` and adds `dryRun/total/succeeded/failed/results[]`.
- Exit `1` when any item failed (same meaning as doctor/validate failure), `2` for usage errors or a declined confirm.
- Ops verbs fall back to `LEMON_SQUEEZY_STORE_ID` when `--store-ids` is omitted; `doctor`/`validate` keep requiring explicit stores.

## Consequences

The bulk executor lives in `src/cli/commands/bulkOps.ts` with no dependency on the command handler, so the interactive menu can reuse it.
