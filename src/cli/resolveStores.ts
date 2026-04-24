import type { FreshSqueezyClient } from "../createFreshSqueezy.js";
import { FreshSqueezyError } from "../core/errors.js";
import { pickStores } from "./prompts.js";

/**
 * Inputs the CLI has when it needs to figure out which stores to validate.
 * Kept flag-only + TTY — the CLI deliberately does not read
 * `LEMON_SQUEEZY_STORE_ID`. Library consumers still can (via `createFreshSqueezy`).
 */
export interface ResolveStoresInput {
  storeIds?: string[];
  allStores?: boolean;
  /** Whether stdin is attached to a TTY so we can prompt. */
  isInteractive: boolean;
}

export interface ResolveStoresOutput {
  storeIds: string[];
  /**
   * True when the resolver could not pick any store AND was not asked to.
   * The caller should fall back to a connection-only run in that case.
   */
  skipped: boolean;
}

/**
 * Decide which store IDs a doctor/validate run should cover.
 *
 * Resolution order (highest → lowest):
 *   1. `--store-ids 1,2,3` flag
 *   2. `--all-stores` flag (fetch every reachable store)
 *   3. TTY + inquirer multi-select
 *   4. Non-TTY, no flag → `skipped: true`
 *
 * `skipped` lets the caller decide whether to run only connection-level checks
 * or fail loudly — different subcommands want different behavior.
 */
export async function resolveStores(
  client: FreshSqueezyClient,
  input: ResolveStoresInput
): Promise<ResolveStoresOutput> {
  if (input.storeIds && input.storeIds.length > 0) {
    return { storeIds: dedupe(input.storeIds), skipped: false };
  }

  if (input.allStores) {
    const ids = await fetchReachableStoreIds(client);
    if (ids.length === 0) {
      throw new FreshSqueezyError({
        code: "NO_STORES",
        message: "No stores reachable with this API key.",
      });
    }
    return { storeIds: ids, skipped: false };
  }

  if (!input.isInteractive) {
    return { storeIds: [], skipped: true };
  }

  const ids = await fetchReachableStoreIds(client);
  if (ids.length === 0) {
    throw new FreshSqueezyError({
      code: "NO_STORES",
      message: "No stores reachable with this API key.",
    });
  }
  if (ids.length === 1) {
    return { storeIds: ids, skipped: false };
  }

  const detailed = await Promise.all(
    ids.map(async (id) => {
      const result = await client.validateStore(id);
      return {
        id,
        name: result.resource?.name ?? "(unnamed)",
        slug: result.resource?.slug ?? "",
      };
    })
  );

  const picked = await pickStores(detailed);
  if (picked.length === 0) {
    throw new FreshSqueezyError({
      code: "NO_SELECTION",
      message: "No store selected. Pick at least one to continue.",
    });
  }
  return { storeIds: picked, skipped: false };
}

/**
 * Fetch every store reachable with the current key. Errors from the underlying
 * request propagate — callers handle them at the command boundary.
 */
async function fetchReachableStoreIds(client: FreshSqueezyClient): Promise<string[]> {
  const connection = await client.validateConnection();
  if (!connection.ok) {
    const authIssue = connection.issues.find((entry) => entry.code === "AUTH_FAILED");
    if (authIssue) {
      throw new FreshSqueezyError({
        code: "AUTH_FAILED",
        message: authIssue.message,
      });
    }
  }
  return connection.resource?.storeIds ?? [];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
