# Messy-repo MATRIX — fresh-squeezy

Updated: 2026-08-07 (**close-wave complete**)
Mode: last = **close-wave**
Product tip: `main` / `origin/main` @ `e28b4890af538bbb6acb174973ef81137532dd78`

## Backups (retained — remote + local)

| Ref | SHA | Role |
|-----|-----|------|
| `backup/messy-setup-20260806T214450Z-origin-main` | `072b356` | pre-wave origin |
| `backup/messy-setup-20260806T214450Z-local-main` | `0cb99aa` | pre-wave local tip |

## Lanes

| Feature | Issue | PR | Pre-merge head | On tip? | Local worktree | Local branch | Remote branch |
|---------|-------|-----|----------------|---------|----------------|--------------|---------------|
| package-scripts-agent-docs | #8 | #15 | `6680a8a` | **yes** | removed | deleted | **retained** |
| docs-pnpm-align | #7 | #16 | `2869e53` | **yes** | removed | deleted | **retained** |
| core-http | #9 | #21 | `4427398` | **yes** | removed | deleted | **retained** |
| resources-ops | #11 | #19 | `b25c84c` | **yes** | removed | deleted | **retained** |
| validate-doctor | #10 | #17 | `c0c22ed` | **yes** | removed | deleted | **retained** |
| create-client | #12 | #20 | `e5c27a6` | **yes** | removed | deleted | **retained** |
| cli-front-door | #13 | #22 | `3642a77` | **yes** | removed | deleted | **retained** |
| support-drift-ci | #14 | #18 | `a839c86` | **yes** | removed | deleted | **retained** |
| dry-land | — | — | `c38b90a` | local-only prove | removed | deleted | n/a |

## Close-wave actions

- [x] Proved each lane feature SHA is ancestor of `origin/main`
- [x] Removed 9 local worktrees under `.worktrees/`
- [x] Deleted 9 local lane/dry-land branches
- [x] **No** remote branch deletes (feature + backup remotes left)
- [x] No cmux close (host A; none used)
- [x] Campaign docs left at `docs/agent/messy-repo/` (untracked local)

## Campaign complete

setup → audit → land → close. Do not re-fan-out the same features unless a new mess appears.
