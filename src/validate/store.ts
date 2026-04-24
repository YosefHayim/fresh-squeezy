import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { getStore, type StoreAttributes } from "../resources/stores.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

/**
 * Verify a store exists and is reachable with the current API key. A 404
 * typically means the key belongs to a different account, not that the store
 * is gone — the suggested fix reflects that.
 */
export async function validateStore(
  http: HttpClient,
  mode: Mode,
  storeId: string | number
): Promise<ValidationResult<StoreAttributes>> {
  const issues: ValidationIssue[] = [];

  try {
    const store = await getStore(http, storeId);
    return buildResult("store", mode, issues, store.attributes);
  } catch (err) {
    if (err instanceof FreshSqueezyError && err.status === 404) {
      issues.push(
        issue(
          ISSUE_CODES.STORE_NOT_FOUND,
          "error",
          `Store ${storeId} not found with the current API key.`,
          {
            suggestedFix:
              "Check the store ID and confirm the API key belongs to the account that owns it.",
            context: { storeId: String(storeId) },
          }
        )
      );
      return buildResult("store", mode, issues);
    }
    if (err instanceof FreshSqueezyError) {
      issues.push(
        issue(ISSUE_CODES.UNKNOWN, "error", err.message, {
          context: { status: err.status ?? null, code: err.code },
        })
      );
      return buildResult("store", mode, issues);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    issues.push(issue(ISSUE_CODES.UNKNOWN, "error", message));
    return buildResult("store", mode, issues);
  }
}
