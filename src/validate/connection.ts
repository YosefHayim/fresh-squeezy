import type { HttpClient } from "../core/http.js";
import { resolveActualMode } from "../core/mode.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { listStores } from "../resources/stores.js";
import { type UserAttributes, getAuthenticatedUser } from "../resources/users.js";
import { probeCollection } from "./probe.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

/**
 * Connection validator summary attached to the `resource` field. Keeps the
 * validator self-contained — consumers need not call `users/me` again.
 *
 * `actualMode` is derived from the `meta.test_mode` field Lemon Squeezy added
 * to `/v1/users/me` on 2024-01-05 (API changelog). When the caller declared
 * one mode but the key actually belongs to the other, the validator fires a
 * `MODE_MISMATCH` error — the single misconfiguration most likely to cause a
 * prod-in-staging (or vice versa) incident.
 */
export interface ConnectionSummary {
  user: UserAttributes;
  storeCount: number;
  storeIds: string[];
  /** The mode the API key actually belongs to (per `/v1/users/me` meta). */
  actualMode?: Mode;
  /** The mode the caller asked for at construction time. */
  declaredMode: Mode;
}

/**
 * Verify that the API key works, surface the account identity + reachable
 * stores, and cross-check declared mode vs the key's true mode.
 *
 * This is the first check every `doctor()` run performs; if it fails,
 * no downstream validator has anything useful to report.
 */
export const validateConnection = async (
  http: HttpClient,
  mode: Mode,
): Promise<ValidationResult<ConnectionSummary>> => {
  const fetched = await probeCollection(
    async () => {
      const userDoc = await getAuthenticatedUser(http);
      const stores = await listStores(http);
      return { userDoc, stores };
    },
    {
      unauthorized: {
        code: ISSUE_CODES.AUTH_FAILED,
        message: "API key rejected by Lemon Squeezy.",
        suggestedFix: "Regenerate the key at https://app.lemonsqueezy.com/settings/api.",
      },
    },
  );

  if (!fetched.ok) {
    return buildResult("connection", mode, [fetched.issue]);
  }

  const { userDoc, stores } = fetched.resource;
  const actualMode = resolveActualMode(userDoc.meta?.test_mode);
  const summary: ConnectionSummary = {
    user: userDoc.data.attributes,
    storeCount: stores.length,
    storeIds: stores.map((store) => store.id),
    declaredMode: mode,
    ...(actualMode ? { actualMode } : {}),
  };

  const issues: ValidationIssue[] = [];

  if (actualMode && actualMode !== mode) {
    issues.push(
      issue(
        ISSUE_CODES.MODE_MISMATCH,
        "error",
        `API key is a ${actualMode}-mode key but was run with --mode ${mode}.`,
        {
          suggestedFix: `Either pass --mode ${actualMode} or use a ${mode}-mode key from https://app.lemonsqueezy.com/settings/api.`,
          context: { declared: mode, actual: actualMode },
        },
      ),
    );
  }

  if (stores.length === 0) {
    issues.push(
      issue(
        ISSUE_CODES.STORE_NOT_FOUND,
        "warning",
        "API key authenticated but no stores are reachable.",
        { suggestedFix: "Confirm the API key belongs to an account that owns at least one store." },
      ),
    );
  }

  return buildResult("connection", mode, issues, summary);
};

/**
 * Ask the Lemon Squeezy API which mode the configured key actually belongs to.
 *
 * Useful as a fail-fast check at app boot — e.g. refuse to start if a prod key
 * is loaded into a staging deployment — without paying for a full doctor run.
 * Returns `undefined` if the API doesn't surface `meta.test_mode` (older
 * proxies, partial responses).
 *
 * Lives here rather than in `core/mode.ts` so the foundational `core/` layer
 * never imports from `resources/`; the pure `resolveActualMode` it delegates to
 * still lives in `core/`. Throws `FreshSqueezyError` on auth or network
 * failure; callers that want a structured non-throwing result should use
 * `validateConnection` instead.
 */
export const fetchActualMode = async (http: HttpClient): Promise<Mode | undefined> => {
  const doc = await getAuthenticatedUser(http);
  return resolveActualMode(doc.meta?.test_mode);
};
