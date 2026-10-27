import type { Mode } from "@/client/config.js";
import type { Http } from "@/client/http.js";
import type { LicenseKeyAttributes } from "@/client/lemon-squeezy-types.js";
import { fetchResource, storeMismatchFindings } from "./fetch-resource.js";
import {
	buildResult,
	FINDING_CODES,
	type FindingRule,
	findingsFrom,
	type ValidationResult,
} from "./findings.js";

export interface LicenseKeyCheck {
	storeId: string;
	licenseKeyId: string;
}

const isDisabled = (licenseKey: LicenseKeyAttributes) => licenseKey.disabled;

const isExpired = (licenseKey: LicenseKeyAttributes) => {
	const expiresAt = licenseKey.expires_at;
	const isExpirySet = expiresAt !== null;
	return isExpirySet && Date.parse(expiresAt) < Date.now();
};

const isAtActivationLimit = (licenseKey: LicenseKeyAttributes) => {
	const { activation_limit: activationLimit, instances_count: instancesCount } =
		licenseKey;
	const isLimitSet = activationLimit !== null;
	return isLimitSet && instancesCount >= activationLimit;
};

const LICENSE_KEY_RULES: FindingRule<LicenseKeyAttributes>[] = [
	{
		code: FINDING_CODES.LICENSE_KEY_DISABLED,
		severity: "error",
		when: isDisabled,
		message: (licenseKey) => `License key ${licenseKey.key_short} is disabled.`,
		suggestedFix: "Re-enable the license key in the Lemon Squeezy dashboard.",
		context: (licenseKey) => ({ keyShort: licenseKey.key_short }),
	},
	{
		code: FINDING_CODES.LICENSE_KEY_EXPIRED,
		severity: "error",
		when: isExpired,
		message: (licenseKey) =>
			`License key ${licenseKey.key_short} expired at ${licenseKey.expires_at}.`,
		suggestedFix: "Extend the expiration date or issue a new license key.",
		context: (licenseKey) => ({
			keyShort: licenseKey.key_short,
			expiresAt: licenseKey.expires_at,
		}),
	},
	{
		code: FINDING_CODES.LICENSE_KEY_AT_ACTIVATION_LIMIT,
		severity: "warning",
		when: isAtActivationLimit,
		message: (licenseKey) =>
			`License key ${licenseKey.key_short} has reached its activation limit (${licenseKey.instances_count}/${licenseKey.activation_limit}).`,
		suggestedFix:
			"Increase the activation limit or deactivate unused instances.",
		context: (licenseKey) => ({
			keyShort: licenseKey.key_short,
			instancesCount: licenseKey.instances_count,
			activationLimit: licenseKey.activation_limit,
		}),
	},
];

export const validateLicenseKey = async (
	http: Http,
	mode: Mode,
	{ storeId, licenseKeyId }: LicenseKeyCheck,
): Promise<ValidationResult<LicenseKeyAttributes>> => {
	const fetched = await fetchResource<LicenseKeyAttributes>(http, {
		path: `/v1/license-keys/${licenseKeyId}`,
		notFound: {
			code: FINDING_CODES.LICENSE_KEY_NOT_FOUND,
			message: `License key ${licenseKeyId} not found.`,
			suggestedFix: "Verify the license key ID in the Lemon Squeezy dashboard.",
			context: { licenseKeyId },
		},
	});

	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) {
		return buildResult({
			name: "licenseKey",
			mode,
			findings: [fetched.finding],
			target: { label: `license key ${licenseKeyId}`, id: licenseKeyId },
		});
	}

	const licenseKey = fetched.payload;
	const storeFindings = storeMismatchFindings({
		label: "License key",
		code: FINDING_CODES.LICENSE_KEY_STORE_MISMATCH,
		expectedStoreId: storeId,
		actualStoreId: licenseKey.store_id,
		suggestedFix:
			"Use the correct store ID or license key ID — keys should not cross stores.",
	});
	const ruleFindings = findingsFrom(LICENSE_KEY_RULES, licenseKey);
	return buildResult({
		name: "licenseKey",
		mode,
		findings: [...storeFindings, ...ruleFindings],
		resource: licenseKey,
		target: { label: licenseKey.key_short, id: licenseKeyId },
	});
};
