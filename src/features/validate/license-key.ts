import type { LicenseKeyAttributes } from "@/shared/attributes.js";
import type {
	Mode,
	ResourceId,
	ValidationIssue,
	ValidationResult,
} from "@/shared/contracts.js";
import type { HttpClient } from "@/shared/http.js";
import { isPast } from "./dates.js";
import {
	buildResult,
	failedResult,
	ISSUE_CODES,
	type IssueRule,
	issuesOf,
} from "./issues.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";

export interface LicenseKeyValidationOptions {
	storeId: ResourceId;
	licenseKeyId: ResourceId;
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
			code: ISSUE_CODES.LICENSE_KEY_NOT_FOUND,
			message: `License key ${options.licenseKeyId} not found.`,
			suggestedFix: "Verify the license key ID in the Lemon Squeezy dashboard.",
			context: { licenseKeyId: String(options.licenseKeyId) },
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return failedResult("licenseKey", mode, fetched.issue, target);
	}

	const attributes = fetched.resource.attributes;
	const issues = checkLicenseKey(attributes, { storeId: options.storeId });
	return buildResult("licenseKey", mode, issues, attributes, {
		label: attributes.key_short,
		id: String(options.licenseKeyId),
	});
};

const licenseKeyIssueRules: IssueRule<LicenseKeyAttributes>[] = [
	{
		code: ISSUE_CODES.LICENSE_KEY_DISABLED,
		severity: "error",
		isRaised: (attributes) => attributes.disabled,
		message: (attributes) => `License key ${attributes.key_short} is disabled.`,
		suggestedFix: "Re-enable the license key in the Lemon Squeezy dashboard.",
		context: (attributes) => ({ keyShort: attributes.key_short }),
	},
	{
		code: ISSUE_CODES.LICENSE_KEY_EXPIRED,
		severity: "error",
		isRaised: (attributes) => isPast(attributes.expires_at),
		message: (attributes) =>
			`License key ${attributes.key_short} expired at ${attributes.expires_at}.`,
		suggestedFix: "Extend the expiration date or issue a new license key.",
		context: (attributes) => ({
			keyShort: attributes.key_short,
			expiresAt: attributes.expires_at,
		}),
	},
	{
		code: ISSUE_CODES.LICENSE_KEY_AT_ACTIVATION_LIMIT,
		severity: "warning",
		isRaised: ({ activation_limit, instances_count }) =>
			activation_limit !== null && instances_count >= activation_limit,
		message: (attributes) =>
			`License key ${attributes.key_short} has reached its activation limit (${attributes.instances_count}/${attributes.activation_limit}).`,
		suggestedFix:
			"Increase the activation limit or deactivate unused instances.",
		context: (attributes) => ({
			keyShort: attributes.key_short,
			instancesCount: attributes.instances_count,
			activationLimit: attributes.activation_limit,
		}),
	},
];

export const checkLicenseKey = (
	attributes: LicenseKeyAttributes,
	options: { storeId: ResourceId },
): ValidationIssue[] => {
	const ownershipIssues = checkStoreOwnership({
		expectedStoreId: options.storeId,
		actualStoreId: attributes.store_id,
		code: ISSUE_CODES.LICENSE_KEY_STORE_MISMATCH,
		label: "License key",
		suggestedFix:
			"Use the correct store ID or license key ID — keys should not cross stores.",
	});
	return [...ownershipIssues, ...issuesOf(licenseKeyIssueRules, attributes)];
};
