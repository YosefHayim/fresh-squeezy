# ADR-0003: CLI command surface and interactive front door

## Status

Accepted — 2026-07-02

## Context

Bare `fresh-squeezy` in a TTY ran install + guided `init`. A `pickLauncherAction` menu
(doctor / init / examples / exit) existed in `src/cli/prompts.ts` but was never called —
dead code. The docs committed to "bare = install + guided setup." We want the canonical
"interactive front door": a bare invocation in a TTY opens a menu; flags and non-TTY defer
and never hang; both routes call the same functions.

## Decision

Command surface:

```
fresh-squeezy [--no-install]          bare → action menu (TTY) | exit 2 (non-TTY)
fresh-squeezy doctor [flags] [--json]
fresh-squeezy validate <name> [flags] [--json]
    name ∈ connection | store | product | webhook | discount | license-key | subscription-plan
fresh-squeezy init [--env-file <path>]
fresh-squeezy types augment [--out <path>] [--force]
```

Wire `pickLauncherAction` into the bare invocation: in a TTY it lists doctor / validate /
init / types augment / exit and routes to the same command functions; if no API key is
configured it jumps straight to `init`. Non-TTY or `--json` defers (doctor →
connection-only; validate → exit 2 `MISSING_ARG`). Exit codes: `0` pass, `1` fail, `2`
fatal, `130` cancel.

## Consequences

- The dead menu function is retired by being used.
- `docs/cli-reference.md` updates to describe the menu (follow-on).
- The dual-mode contract is honored end-to-end: bare + TTY → menu, flags/non-TTY defer and
  never hang, both routes call the same `run<Verb>Command`.
