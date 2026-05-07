import type { HttpClient } from "./http.js";
import type { Mode } from "./types.js";
import { getAuthenticatedUser } from "../resources/users.js";

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
 * full connection validator.
 */
export function resolveActualMode(testMode: boolean | undefined): Mode | undefined {
  if (testMode === true) return "test";
  if (testMode === false) return "live";
  return undefined;
}

/**
 * Ask the Lemon Squeezy API which mode the configured key actually belongs to.
 *
 * Useful as a fail-fast check at app boot — e.g. refuse to start if a prod key
 * is loaded into a staging deployment — without paying for a full doctor run.
 * Returns `undefined` if the API doesn't surface `meta.test_mode` (older
 * proxies, partial responses).
 *
 * Throws `FreshSqueezyError` on auth or network failure; callers that want a
 * structured non-throwing result should use `validateConnection` instead.
 */
export async function fetchActualMode(http: HttpClient): Promise<Mode | undefined> {
  const doc = await getAuthenticatedUser(http);
  return resolveActualMode(doc.meta?.test_mode);
}
