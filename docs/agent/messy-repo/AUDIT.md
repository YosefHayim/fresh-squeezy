# Messy-repo AUDIT — fresh-squeezy

Updated: 2026-08-07
Product tip (PR base): `main` @ `0cb99aa23f4ff0fec34d2583db27ed5657bc341a`
GitHub default `origin/main`: `072b3566ea00422fcb90bf3f33a50d7f71f08a02` (local tip ahead 2)
MATRIX: docs/agent/messy-repo/MATRIX.md
Mode: audit-wave
New feature PRs this run: **0**

## Scoreboard

| Order | PR | Feature | Head | Intent | Deslop | CODE-STYLE | Tests | Gates | Risk | Verdict | Notes |
|------:|----|---------|------|--------|--------|------------|-------|-------|------|---------|-------|
| 1 | #15 | package-scripts-agent-docs | `6680a8a` | match | better (ceremony) | ok | N/A chore | unit pass; GG pass | low | **MERGE** | check:ci + cli; land first for biome `files` |
| 2 | #16 | docs-pnpm-align | `2869e53` | match | better (dead-doc) | ok | N/A docs | unit pass; GG pass | low | **MERGE** | pnpm CONTRIBUTING/README*; no src/ |
| 3 | #21 | core-http | `4427398` | match | better (line) | ok | business+ | verify green (PR) | low | **MERGE** | HTTP_STATUS_CODES; HTTP/config tests |
| 4 | #19 | resources-ops | `b25c84c` | match | better (structure) | ok | business+ (179→207) | typecheck+test+build; verify needs #15 on tip | low | **MERGE** | registry SSOT; no fantasy catalog writes |
| 5 | #17 | validate-doctor | `c0c22ed` | match | better (line) | ok | business+ | verify green (PR) | low | **MERGE** | short-circuit preserved; issue codes stable |
| 6 | #20 | create-client | `e5c27a6` | match | better (line) | ok | same | tsc+test+build | low | **MERGE** | pure export*; OpVerb typing |
| 7 | #22 | cli-front-door | `3642a77` | match | better (structure) | ok | dual-mode suites | verify green (PR) | low | **MERGE** | table-driven CLI; dual-mode intact |
| 8 | #18 | support-drift-ci | `a839c86` | match | better (ceremony) | ok | scripts 16/16 | GG pass; CI stronger | low | **MERGE** | deleted dead templates; pnpm setup fixes |

## Verdict counts

| MERGE | FIX | HOLD |
|------:|----:|-----:|
| 8 | 0 | 0 |

## HOLD (do not land)

_None._

## FIX (same branch only — no new PR)

_None required._ Optional nits (do **not** block land):

| PR | Optional polish |
|----|-----------------|
| #17 | Product soft-fail code nuance (`NETWORK_ERROR` vs force `UNKNOWN`) — bots flagged; CODE-STYLE prefers probe mapping |
| #19 | `Object.hasOwn` on `RESOURCE_ALIASES` lookup |
| #22 | Doctor JSON fatal always includes `status: null` (additive micro-drift) |
| #18 | Generated-header string still says `npm run generate:api-types` |

## Overlaps / land order

1. **#15** package-scripts-agent-docs  
2. **#16** docs-pnpm-align  
3. **#21** core-http  
4. **#19** resources-ops  
5. **#17** validate-doctor  
6. **#20** create-client  
7. **#22** cli-front-door  
8. **#18** support-drift-ci  

`package.json` biome `files` format touched by several lanes — dry-land merged cleanly with #15 first.

## Dry-land integration

| Item | Value |
|------|--------|
| Base | product tip `main` @ `0cb99aa` |
| Branch | `audit/dry-land-20260806T220101Z` (local only; worktree `.worktrees/dry-land-20260806T220101Z`) |
| Merged in order | #15 → #16 → #21 → #19 → #17 → #20 → #22 → #18 |
| Conflicts | **none** |
| Unit | `pnpm test` → **216 passed** (29 files) |
| Typecheck | `pnpm typecheck` → pass |
| Full gate | `pnpm verify` → **pass** (after `pnpm install --frozen-lockfile` in dry-land; Biome 1.9.4) |
| E2E | **skip** — no browser e2e in this repo; `test:live` needs secrets (`LEMON_SQUEEZY_LIVE_SMOKE`) |
| Tip advanced? | **no** |

## Code slices (for planpage)

| Feature | Path | Why shown |
|---------|------|-----------|
| core-http | `src/core/http.ts` | `HTTP_STATUS_CODES` as const |
| validate | `src/validate/doctor.ts` | composition + short-circuit |
| resources | `src/resources/registry.ts` | SSOT aliases |
| cli | `src/cli/main.ts` | table-driven validate commands |
| scripts | `package.json` scripts | check:ci / cli / verify |

## Residual mess (not this wave)

- Local `main` still **ahead 2** of `origin/main` — GitHub PR diffs include those commits until tip is pushed
- Root worktree dirty: uncommitted CLAUDE/gitignore vs #15 branch versions
- Optional live smoke not run
- Promote tip → default after land if desired

## Audit success checklist

- [x] No new feature PRs opened  
- [x] Every MATRIX open PR has verdict MERGE\|FIX\|HOLD  
- [x] deslop + CODE-STYLE + tests scored with evidence  
- [x] dry-land unit/verify recorded  
- [x] AUDIT + draft HEALTH + planpage  
- [x] Product tip SHA unchanged (`0cb99aa`)
