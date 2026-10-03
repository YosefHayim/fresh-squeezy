# Product health — fresh-squeezy

status: post-land + close-wave  
updated: 2026-08-07

## Tips

| Ref | SHA | Role |
|-----|-----|------|
| product tip / origin/main | `e28b489` | advanced via PR merges only |
| pre-land local tip | `0cb99aa` | absorbed into wave (in PR ancestry) |
| backup/messy-setup-…-origin-main | `072b356` | pre-wave origin restore |
| backup/messy-setup-…-local-main | `0cb99aa` | pre-wave local tip restore |

## Features

| id | paths | tests | risk | wave disposition |
|----|-------|-------|------|------------------|
| package-scripts | package.json, AGENTS, CLAUDE, .gitignore | n/a | low | **merged** #15 |
| docs-pnpm | CONTRIBUTING, README* | n/a | low | **merged** #16 |
| core-http | src/core/** | http/config expanded | low | **merged** #21 |
| resources-ops | src/resources/** | consolidated business | low | **merged** #19 |
| validate-doctor | src/validate/** | doctor/product suites | low | **merged** #17 |
| create-client | createFreshSqueezy, index, augmentations | augmentations | low | **merged** #20 |
| cli-front-door | src/cli/** | dual-mode suites | low | **merged** #22 |
| support-drift-ci | support, scripts, workflows | script 16/16 | low | **merged** #18 |

## Structure tree (top levels)

```text
src/
  generated/     Lemon Squeezy attribute types
  core/          HttpClient, config, errors, mode
  resources/     JSON:API helpers + registry + invokeOp
  validate/      doctor + validators + probe/rules
  support/       static manifest + changelog snapshot
  cli/           commander dual-mode front door
  scripts/       changelog drift + API-type generation
  index.ts       pure export * barrel
.github/workflows/  ci, changelog-drift, live-smoke, release, publish
```

## How code is written (slices)

### 1. core-http — `src/core/http.ts`

```ts
const HTTP_STATUS_CODES = {
  401: "UNAUTHORIZED",
  404: "NOT_FOUND",
  429: "RATE_LIMITED",
} as const;
```

### 2. validate — doctor short-circuit

Connection first; short-circuit on failure; pure `check*` + probe mapping; stable `issue.code`.

### 3. resources — registry SSOT

Catalog resources stay get/list only; consolidated unit coverage on helpers/invokeOp/registry.

### 4. cli — dual-mode

Table-driven validate/doctor targets; bare non-TTY exits 2 without hang; destructive needs `--yes` or TTY confirm.

## Tests

| Layer | Command | Result |
|-------|---------|--------|
| unit | `pnpm test` | **216 passed** (29 files) |
| typecheck | `pnpm typecheck` | pass |
| build | `pnpm build` | pass |
| biome (tracked) | `biome ci` on `git ls-files` | pass |
| full `pnpm verify` | biome walks local dirs | **pass on product tree**; local `.worktrees/` + untracked `docs/agent/` can trip bare `biome ci .` until ignored or removed |
| e2e browser | — | **skip** (none) |
| live smoke | `pnpm test:live` | **skip** (secrets) |

## Branches

| Class | Count | Names |
|-------|-------|-------|
| product lanes open | 0 | all 8 MERGED |
| merged this land | 8 | #15 #16 #21 #19 #17 #20 #22 #18 |
| backups | retained | messy-setup-*, preserve-*, mac-reset-* |
| remote feature branches | retained | deleteBranchOnMerge=false; not deleted |

## Worktrees

| Path | Keep? | Reason |
|------|-------|--------|
| `.worktrees/*` | **removed** (close-wave) | all 8 lanes + dry-land |
| `docs/agent/messy-repo/` | keep local | campaign artifacts (untracked) |

## Residual

- Remote feature branches still on origin (not deleted) — name them if you want them gone
- Backups retained on origin + local
- Optional nits from AUDIT (non-blocking)
- Live smoke not run
- Optional: `biome.json` ignore `docs/agent` if bare verify ever scans campaign JSON
