import { FreshSqueezyError } from "../core/errors.js";
import type { ValidationIssue } from "../core/types.js";
import { ISSUE_CODES, issue } from "./rules.js";

/**
 * How a caller wants the error mapper to translate specific failure modes.
 * Every field is optional — omit a slot and that mode falls through to the
 * generic mappings (`NETWORK_ERROR`, `UNKNOWN`).
 */
export interface IssueMapping {
  /** Translate 401 / `UNAUTHORIZED` to a specific issue code (e.g. `AUTH_FAILED`). */
  unauthorized?: { code: string; message: string; suggestedFix?: string };
  /** Translate 404 to a resource-specific not-found issue. */
  notFound?: {
    code: string;
    message: string;
    suggestedFix?: string;
    context?: ValidationIssue["context"];
  };
}

/**
 * Map any thrown error from a resource fetch to a `ValidationIssue`. The
 * single source of truth for "how does this validator surface failures?":
 *
 *   - 401 → `mapping.unauthorized.code` if provided, else fall through
 *   - 404 → `mapping.notFound.code` if provided, else fall through
 *   - network failure → `NETWORK_ERROR`
 *   - any other `FreshSqueezyError` → `UNKNOWN` (with status + code context)
 *   - any other `Error` → `UNKNOWN`
 *
 * Public so validators that own a non-trivial composite call (e.g.
 * `validateConnection`, which fetches users + stores in one try-block) can
 * reuse the same mapper as `probeFetch` does for single-resource fetches.
 */
export function mapErrorToIssue(err: unknown, mapping: IssueMapping = {}): ValidationIssue {
  if (err instanceof FreshSqueezyError) {
    if (mapping.unauthorized && (err.status === 401 || err.code === "UNAUTHORIZED")) {
      return issue(mapping.unauthorized.code, "error", mapping.unauthorized.message, {
        ...(mapping.unauthorized.suggestedFix !== undefined
          ? { suggestedFix: mapping.unauthorized.suggestedFix }
          : {}),
        context: { status: err.status ?? null },
      });
    }
    if (mapping.notFound && err.status === 404) {
      return issue(mapping.notFound.code, "error", mapping.notFound.message, {
        ...(mapping.notFound.suggestedFix !== undefined
          ? { suggestedFix: mapping.notFound.suggestedFix }
          : {}),
        ...(mapping.notFound.context !== undefined ? { context: mapping.notFound.context } : {}),
      });
    }
    if (err.code === "NETWORK_ERROR") {
      return issue(
        ISSUE_CODES.NETWORK_ERROR,
        "error",
        `Could not reach Lemon Squeezy: ${err.message}`,
      );
    }
    return issue(ISSUE_CODES.UNKNOWN, "error", err.message, {
      context: { status: err.status ?? null, code: err.code },
    });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return issue(ISSUE_CODES.UNKNOWN, "error", message);
}

/**
 * Per-validator metadata for the resource-fetch probe.
 *
 * `notFoundCode` and `notFoundMessage` are resource-specific so each validator
 * keeps its stable `ISSUE_CODES.*_NOT_FOUND` identifier in callsite-visible
 * code. Everything else (mapping `FreshSqueezyError` shapes, falling back to
 * `UNKNOWN`, attaching status/code context) is handled here so validators
 * stop re-implementing the same try/catch skeleton.
 */
export interface FetchProbeOptions {
  notFoundCode: string;
  notFoundMessage: string;
  notFoundFix?: string;
  notFoundContext?: ValidationIssue["context"];
}

/**
 * Outcome of a probed resource fetch. Either the resource (caller continues
 * with assertions) or one normalized issue (caller bails with `buildResult`).
 */
export type FetchProbeOutcome<T> =
  | { ok: true; resource: T }
  | { ok: false; issue: ValidationIssue };

/**
 * Run a resource fetch with the same error mapping every single-resource
 * validator needs. Delegates to `mapErrorToIssue` so the rules live in
 * exactly one place.
 *
 * Validators keep their resource-specific assertion logic; only the I/O
 * scaffolding lives here. The deletion test: if this module disappeared every
 * validator would grow back the same try/catch skeleton.
 */
export async function probeFetch<T>(
  fetcher: () => Promise<T>,
  options: FetchProbeOptions,
): Promise<FetchProbeOutcome<T>> {
  return probeCollection(fetcher, {
    notFound: {
      code: options.notFoundCode,
      message: options.notFoundMessage,
      ...(options.notFoundFix !== undefined ? { suggestedFix: options.notFoundFix } : {}),
      ...(options.notFoundContext !== undefined ? { context: options.notFoundContext } : {}),
    },
  });
}

/**
 * Run a fetch — typically a list/collection endpoint — through the shared
 * error mapper without `probeFetch`'s single-resource `notFound` slot. Pass an
 * `IssueMapping` to translate specific statuses (e.g. 401 → `AUTH_FAILED` for
 * the connection validator); omit it and every failure normalizes to
 * `NETWORK_ERROR` / `UNKNOWN`.
 *
 * The deletion test: without this, `validateWebhook` and `validateConnection`
 * would each hand-roll the same try/catch → `mapErrorToIssue` skeleton that
 * `probeFetch` already centralizes for single-resource fetches.
 */
export async function probeCollection<T>(
  fetcher: () => Promise<T>,
  mapping: IssueMapping = {},
): Promise<FetchProbeOutcome<T>> {
  try {
    return { ok: true, resource: await fetcher() };
  } catch (err) {
    return { ok: false, issue: mapErrorToIssue(err, mapping) };
  }
}

/**
 * Inputs for a store-ownership cross-check.
 *
 * `code` and `label` are resource-specific so the issue stays informative
 * ("Discount belongs to store …" vs "Product belongs to store …"). `id` and
 * `extraContext` let validators describe which resource was inspected so
 * downstream tooling can correlate the mismatch with the request that
 * produced it.
 */
export interface OwnershipCheck {
  expectedStoreId: string | number;
  actualStoreId: string | number;
  /** Stable issue code (e.g. `ISSUE_CODES.DISCOUNT_STORE_MISMATCH`). */
  code: string;
  /** Resource label used in the issue message (e.g. `"Discount"`). */
  label: string;
  suggestedFix?: string;
  /** Extra context fields merged in alongside `expectedStoreId` / `actualStoreId`. */
  extraContext?: ValidationIssue["context"];
}

/**
 * Compare an expected store ID against the value Lemon Squeezy returned on
 * the resource. Returns a `ValidationIssue` if they don't match, or `null` if
 * ownership is fine. Validators add the issue to their issue list — this
 * helper does not push for them.
 *
 * Both inputs are coerced via `String(...)` so a numeric `store_id` from JSON
 * compares correctly against a string-typed `storeId` from the CLI / env.
 */
export function checkStoreOwnership(check: OwnershipCheck): ValidationIssue | null {
  const expected = String(check.expectedStoreId);
  const actual = String(check.actualStoreId);
  if (expected === actual) return null;

  const context: ValidationIssue["context"] = {
    expectedStoreId: expected,
    actualStoreId: actual,
    ...(check.extraContext ?? {}),
  };

  return issue(
    check.code,
    "error",
    `${check.label} belongs to store ${actual}, expected ${expected}.`,
    {
      ...(check.suggestedFix !== undefined ? { suggestedFix: check.suggestedFix } : {}),
      context,
    },
  );
}
