import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { getLicenseKey, type LicenseKeyAttributes } from "../resources/licenseKeys.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";
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

  const fetched = await probeFetch(() => getLicenseKey(http, options.licenseKeyId), {
    notFoundCode: ISSUE_CODES.LICENSE_KEY_NOT_FOUND,
    notFoundMessage: `License key ${options.licenseKeyId} not found.`,
    notFoundFix: "Verify the license key ID in the Lemon Squeezy dashboard.",
    notFoundContext: { licenseKeyId: String(options.licenseKeyId) },
  });

  if (!fetched.ok) {
    issues.push(fetched.issue);
    return buildResult<LicenseKeyAttributes>("licenseKey", mode, issues, undefined, {
      label: `license key ${options.licenseKeyId}`,
      id: String(options.licenseKeyId),
    });
  }

  const attrs = fetched.resource.attributes;

  const mismatch = checkStoreOwnership({
    expectedStoreId: options.storeId,
    actualStoreId: attrs.store_id,
    code: ISSUE_CODES.LICENSE_KEY_STORE_MISMATCH,
    label: "License key",
    suggestedFix: "Use the correct store ID or license key ID — keys should not cross stores.",
  });
  if (mismatch) issues.push(mismatch);

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

  return buildResult("licenseKey", mode, issues, attrs, {
    label: attrs.key_short,
    id: String(options.licenseKeyId),
  });
}
