import type { ValidationIssue, ValidationResult, ValidationSeverity } from "../core/types.js";

/**
 * Stable issue codes. Consumers may switch on these in CI — do not rename
 * without a major version bump.
 */
export const ISSUE_CODES = {
  AUTH_FAILED: "AUTH_FAILED",
  MODE_MISMATCH: "MODE_MISMATCH",
  STORE_NOT_FOUND: "STORE_NOT_FOUND",
  STORE_NOT_OWNED: "STORE_NOT_OWNED",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_WRONG_STORE: "PRODUCT_WRONG_STORE",
  PRODUCT_UNPUBLISHED: "PRODUCT_UNPUBLISHED",
  PRODUCT_NO_BUY_URL: "PRODUCT_NO_BUY_URL",
  VARIANT_UNPUBLISHED: "VARIANT_UNPUBLISHED",
  VARIANT_MISSING: "VARIANT_MISSING",
  WEBHOOK_NOT_FOUND: "WEBHOOK_NOT_FOUND",
  WEBHOOK_EVENTS_MISSING: "WEBHOOK_EVENTS_MISSING",
  WEBHOOK_OPTIONAL_EVENTS: "WEBHOOK_OPTIONAL_EVENTS",
  DISCOUNT_NOT_FOUND: "DISCOUNT_NOT_FOUND",
  DISCOUNT_DRAFT: "DISCOUNT_DRAFT",
  DISCOUNT_EXPIRED: "DISCOUNT_EXPIRED",
  DISCOUNT_NOT_STARTED: "DISCOUNT_NOT_STARTED",
  DISCOUNT_REDEMPTIONS_EXHAUSTED: "DISCOUNT_REDEMPTIONS_EXHAUSTED",
  DISCOUNT_INVALID_AMOUNT: "DISCOUNT_INVALID_AMOUNT",
  DISCOUNT_STORE_MISMATCH: "DISCOUNT_STORE_MISMATCH",
  LICENSE_KEY_NOT_FOUND: "LICENSE_KEY_NOT_FOUND",
  LICENSE_KEY_DISABLED: "LICENSE_KEY_DISABLED",
  LICENSE_KEY_EXPIRED: "LICENSE_KEY_EXPIRED",
  LICENSE_KEY_AT_ACTIVATION_LIMIT: "LICENSE_KEY_AT_ACTIVATION_LIMIT",
  LICENSE_KEY_STORE_MISMATCH: "LICENSE_KEY_STORE_MISMATCH",
  PLAN_VARIANT_NOT_FOUND: "PLAN_VARIANT_NOT_FOUND",
  PLAN_NOT_SUBSCRIPTION: "PLAN_NOT_SUBSCRIPTION",
  PLAN_INVALID_INTERVAL: "PLAN_INVALID_INTERVAL",
  PLAN_FREE_PRICE: "PLAN_FREE_PRICE",
  PLAN_TRIAL_INCONSISTENT: "PLAN_TRIAL_INCONSISTENT",
  PLAN_DRAFT: "PLAN_DRAFT",
  PLAN_STORE_MISMATCH: "PLAN_STORE_MISMATCH",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNKNOWN: "UNKNOWN",
} as const;

/**
 * Build a `ValidationIssue` with defaults for the common case.
 * Extracted so every validator produces consistently shaped issues.
 */
export function issue(
  code: string,
  severity: ValidationSeverity,
  message: string,
  extras: { suggestedFix?: string; context?: ValidationIssue["context"] } = {}
): ValidationIssue {
  const base: ValidationIssue = { code, severity, message };
  if (extras.suggestedFix !== undefined) base.suggestedFix = extras.suggestedFix;
  if (extras.context !== undefined) base.context = extras.context;
  return base;
}

/**
 * Fold an issue list into a boolean. Used by every validator so `ok` is
 * computed the same way everywhere.
 */
export function isOk(issues: ValidationIssue[]): boolean {
  return !issues.some((entry) => entry.severity === "error");
}

/**
 * Compose a `ValidationResult` with the `ok` flag derived from issues.
 */
export function buildResult<T>(
  name: string,
  mode: ValidationResult["mode"],
  issues: ValidationIssue[],
  resource?: T
): ValidationResult<T> {
  const result: ValidationResult<T> = {
    name,
    ok: isOk(issues),
    mode,
    issues,
  };
  if (resource !== undefined) result.resource = resource;
  return result;
}
