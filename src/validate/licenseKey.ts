import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { getLicenseKey, type LicenseKeyAttributes } from "../resources/licenseKeys.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

export interface LicenseKeyValidationOptions {
  storeId: string | number;
  licenseKeyId: string | number;
}

/**
 * Validate a Lemon Squeezy license key. Surfaces disabled keys, expired
 * keys, keys at their activation limit, and store ownership mismatches — the
 * four states most likely to cause "why can't my customer activate?"
 * support tickets.
 */
export async function validateLicenseKey(
  http: HttpClient,
  mode: Mode,
  options: LicenseKeyValidationOptions
): Promise<ValidationResult<LicenseKeyAttributes>> {
  const issues: ValidationIssue[] = [];

  let licenseKey;
  try {
    licenseKey = await getLicenseKey(http, options.licenseKeyId);
  } catch (err) {
    if (err instanceof FreshSqueezyError && err.status === 404) {
      issues.push(
        issue(
          ISSUE_CODES.LICENSE_KEY_NOT_FOUND,
          "error",
          `License key ${options.licenseKeyId} not found.`,
          {
            suggestedFix: "Verify the license key ID in the Lemon Squeezy dashboard.",
            context: { licenseKeyId: String(options.licenseKeyId) },
          }
        )
      );
      return buildResult("licenseKey", mode, issues);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    issues.push(issue(ISSUE_CODES.UNKNOWN, "error", message));
    return buildResult("licenseKey", mode, issues);
  }

  const attrs = licenseKey.attributes;

  const expectedStore = String(options.storeId);
  const actualStore = String(attrs.store_id);
  if (expectedStore !== actualStore) {
    issues.push(
      issue(
        ISSUE_CODES.LICENSE_KEY_STORE_MISMATCH,
        "error",
        `License key belongs to store ${actualStore}, expected ${expectedStore}.`,
        {
          suggestedFix: "Use the correct store ID or license key ID — keys should not cross stores.",
          context: { expectedStoreId: expectedStore, actualStoreId: actualStore },
        }
      )
    );
  }

  if (attrs.disabled) {
    issues.push(
      issue(
        ISSUE_CODES.LICENSE_KEY_DISABLED,
        "error",
        `License key ${attrs.key_short} is disabled.`,
        {
          suggestedFix: "Re-enable the license key in the Lemon Squeezy dashboard.",
          context: { keyShort: attrs.key_short },
        }
      )
    );
  }

  if (attrs.expires_at && new Date(attrs.expires_at) < new Date()) {
    issues.push(
      issue(
        ISSUE_CODES.LICENSE_KEY_EXPIRED,
        "error",
        `License key ${attrs.key_short} expired at ${attrs.expires_at}.`,
        {
          suggestedFix: "Extend the expiration date or issue a new license key.",
          context: { keyShort: attrs.key_short, expiresAt: attrs.expires_at },
        }
      )
    );
  }

  if (attrs.activation_limit !== null && attrs.instances_count >= attrs.activation_limit) {
    issues.push(
      issue(
        ISSUE_CODES.LICENSE_KEY_AT_ACTIVATION_LIMIT,
        "warning",
        `License key ${attrs.key_short} has reached its activation limit (${attrs.instances_count}/${attrs.activation_limit}).`,
        {
          suggestedFix: "Increase the activation limit or deactivate unused instances.",
          context: {
            keyShort: attrs.key_short,
            instancesCount: attrs.instances_count,
            activationLimit: attrs.activation_limit,
          },
        }
      )
    );
  }

  return buildResult("licenseKey", mode, issues, attrs);
}
