import type {
	Mode,
	ValidationIssue,
	ValidationResult,
} from "@/contracts/contracts.js";
import type { HttpClient } from "@/http/http.js";
import type { LicenseKeyAttributes } from "@/resources/attributes.js";
import { buildResult, ISSUE_CODES, issue } from "./issues.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";

export interface LicenseKeyValidationOptions {
	storeId: string | number;
	licenseKeyId: string | number;
}

export const validateLicenseKey = async (
	http: HttpClient,
	mode: Mode,
	options: LicenseKeyValidationOptions,
): Promise<ValidationResult<LicenseKeyAttributes>> => {
	const target = {
		label: `license key ${options.licenseKeyId}`,
		id: String(options.licenseKeyId),
	};

	const fetched = await probeFetch(
		() =>
			http.getResource<LicenseKeyAttributes>(
				`/v1/license-keys/${options.licenseKeyId}`,
			),
		{
			notFoundCode: ISSUE_CODES.LICENSE_KEY_NOT_FOUND,
			notFoundMessage: `License key ${options.licenseKeyId} not found.`,
			notFoundFix: "Verify the license key ID in the Lemon Squeezy dashboard.",
			notFoundContext: { licenseKeyId: String(options.licenseKeyId) },
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return buildResult<LicenseKeyAttributes>(
			"licenseKey",
			mode,
			[fetched.issue],
			undefined,
			target,
		);
	}

	const attrs = fetched.resource.attributes;
	const issues = checkLicenseKey(attrs, { storeId: options.storeId });
	return buildResult("licenseKey", mode, issues, attrs, {
		label: attrs.key_short,
		id: String(options.licenseKeyId),
	});
};

export const checkLicenseKey = (
	attrs: LicenseKeyAttributes,
	options: { storeId: string | number },
): ValidationIssue[] => {
	const issues: ValidationIssue[] = [];

	const mismatch = checkStoreOwnership({
		expectedStoreId: options.storeId,
		actualStoreId: attrs.store_id,
		code: ISSUE_CODES.LICENSE_KEY_STORE_MISMATCH,
		label: "License key",
		suggestedFix:
			"Use the correct store ID or license key ID — keys should not cross stores.",
	});
	if (mismatch) issues.push(mismatch);

	if (attrs.disabled) {
		const disabledIssue = issue(
			ISSUE_CODES.LICENSE_KEY_DISABLED,
			"error",
			`License key ${attrs.key_short} is disabled.`,
			{
				suggestedFix:
					"Re-enable the license key in the Lemon Squeezy dashboard.",
				context: { keyShort: attrs.key_short },
			},
		);
		issues.push(disabledIssue);
	}

	const expiryDate = attrs.expires_at ? new Date(attrs.expires_at) : null;
	const now = new Date();
	const isExpired = expiryDate !== null && expiryDate < now;
	if (isExpired) {
		const expiredIssue = issue(
			ISSUE_CODES.LICENSE_KEY_EXPIRED,
			"error",
			`License key ${attrs.key_short} expired at ${attrs.expires_at}.`,
			{
				suggestedFix: "Extend the expiration date or issue a new license key.",
				context: { keyShort: attrs.key_short, expiresAt: attrs.expires_at },
			},
		);
		issues.push(expiredIssue);
	}

	const activationLimit = attrs.activation_limit;
	const hasActivationLimit = activationLimit !== null;
	const isAtActivationLimit =
		hasActivationLimit && attrs.instances_count >= activationLimit;
	if (isAtActivationLimit) {
		const activationLimitIssue = issue(
			ISSUE_CODES.LICENSE_KEY_AT_ACTIVATION_LIMIT,
			"warning",
			`License key ${attrs.key_short} has reached its activation limit (${attrs.instances_count}/${attrs.activation_limit}).`,
			{
				suggestedFix:
					"Increase the activation limit or deactivate unused instances.",
				context: {
					keyShort: attrs.key_short,
					instancesCount: attrs.instances_count,
					activationLimit: attrs.activation_limit,
				},
			},
		);
		issues.push(activationLimitIssue);
	}

	return issues;
};
