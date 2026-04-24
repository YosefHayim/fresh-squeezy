import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { getAuthenticatedUser, type UserAttributes } from "../resources/users.js";
import { listStores } from "../resources/stores.js";
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
export async function validateConnection(
  http: HttpClient,
  mode: Mode
): Promise<ValidationResult<ConnectionSummary>> {
  const issues: ValidationIssue[] = [];

  try {
    const userDoc = await getAuthenticatedUser(http);
    const stores = await listStores(http);

    const actualMode = resolveActualMode(userDoc.meta?.test_mode);
    const summary: ConnectionSummary = {
      user: userDoc.data.attributes,
      storeCount: stores.length,
      storeIds: stores.map((store) => store.id),
      declaredMode: mode,
      ...(actualMode ? { actualMode } : {}),
    };

    if (actualMode && actualMode !== mode) {
      issues.push(
        issue(
          ISSUE_CODES.MODE_MISMATCH,
          "error",
          `API key is a ${actualMode}-mode key but was run with --mode ${mode}.`,
          {
            suggestedFix: `Either pass --mode ${actualMode} or use a ${mode}-mode key from https://app.lemonsqueezy.com/settings/api.`,
            context: { declared: mode, actual: actualMode },
          }
        )
      );
    }

    if (stores.length === 0) {
      issues.push(
        issue(
          ISSUE_CODES.STORE_NOT_FOUND,
          "warning",
          "API key authenticated but no stores are reachable.",
          { suggestedFix: "Confirm the API key belongs to an account that owns at least one store." }
        )
      );
    }

    return buildResult("connection", mode, issues, summary);
  } catch (err) {
    issues.push(toConnectionIssue(err));
    return buildResult("connection", mode, issues);
  }
}

/**
 * Map the boolean `meta.test_mode` flag to our `Mode` type. Returns
 * `undefined` when the field is absent so older accounts / proxies that
 * don't surface it don't produce spurious MODE_MISMATCH failures.
 */
function resolveActualMode(testMode: boolean | undefined): Mode | undefined {
  if (testMode === true) return "test";
  if (testMode === false) return "live";
  return undefined;
}

function toConnectionIssue(err: unknown): ValidationIssue {
  if (err instanceof FreshSqueezyError) {
    if (err.code === "UNAUTHORIZED") {
      return issue(ISSUE_CODES.AUTH_FAILED, "error", "API key rejected by Lemon Squeezy.", {
        suggestedFix: "Regenerate the key at https://app.lemonsqueezy.com/settings/api.",
        context: { status: err.status ?? null },
      });
    }
    if (err.code === "NETWORK_ERROR") {
      return issue(ISSUE_CODES.NETWORK_ERROR, "error", `Could not reach Lemon Squeezy: ${err.message}`);
    }
    return issue(ISSUE_CODES.UNKNOWN, "error", err.message, {
      context: { status: err.status ?? null, code: err.code },
    });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return issue(ISSUE_CODES.UNKNOWN, "error", message);
}
