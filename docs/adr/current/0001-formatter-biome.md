# ADR-0001: Biome for formatting, linting, and import ordering

## Status

Accepted — 2026-07-02

## Context

The repo had no formatter or linter config, yet the style is remarkably consistent (double
quotes, semicolons, ~100 width, trailing commas, `node:` → third-party → local imports).
Nothing enforced it. The project ethos is "small and boring" with a single lockfile and a
minimal dependency set.

## Decision

Adopt Biome as the single tool for format + lint + import-organizing (`biome.json`). Add
`format` (`biome format --write .`) and `lint` (`biome check .`) scripts and a
`@biomejs/biome` devDependency. The config encodes the observed style verbatim.

Considered and rejected:

- **Prettier only** — formats but no lint, no import ordering without a plugin.
- **Prettier + typescript-eslint + eslint-plugin-import** — maximum control (could enforce
  the intra-local `core → resources → validate` grouping and lint the no-default-export /
  no-top-level-arrow rules), but ~6+ dependencies and a flat-config to maintain.

Biome wins on one-dependency simplicity and speed, matching the ethos.

## Consequences

- One devDependency covers formatting, linting, and import organization.
- Import grouping is `node → external → internal`; the intra-local `core → resources →
  validate` ordering is a `CODE-STYLE.md` convention, not separately enforced.
- Follow-on: install and run `npm run format` once to normalize the tree; optionally wire
  Biome into a pre-commit hook (`setup-pre-commit`).
