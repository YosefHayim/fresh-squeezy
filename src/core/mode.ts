import type { Mode } from "./types.js";

/**
 * Map the boolean `meta.test_mode` flag from `/v1/users/me` to our `Mode` type.
 *
 * Returns `undefined` when the field is absent so older accounts and proxies
 * that don't surface the flag don't produce spurious mode mismatches. Lemon
 * Squeezy added `meta.test_mode` to the endpoint on 2024-01-05 (see API
 * changelog: https://docs.lemonsqueezy.com/api/getting-started/changelog).
 *
 * Pure function — exposed publicly so consumers can resolve a key's true mode
 * from a `/v1/users/me` document they already have, without re-running the
 * full connection validator. Keeping it free of any resource import is what
 * lets `core/` stay foundational (it never reaches up into `resources/`); the
 * I/O counterpart `fetchActualMode` lives in `validate/connection.ts`.
 */
export function resolveActualMode(testMode: boolean | undefined): Mode | undefined {
  if (testMode === true) return "test";
  if (testMode === false) return "live";
  return undefined;
}
