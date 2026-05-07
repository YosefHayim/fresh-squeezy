# CLAUDE.md

Project-level guidance for Claude Code working in this repo.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `YosefHayim/fresh-squeezy`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) map 1:1 to GitHub label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` and `docs/adr/` at the repo root (created lazily by `/grill-with-docs`). See `docs/agents/domain.md`.
