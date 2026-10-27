import { makeHttp, route } from "@e2e/mock-fetch.js";
import {
	activeLicenseKeyDocument,
	atLimitLicenseKeyDocument,
	disabledLicenseKeyDocument,
	expiredLicenseKeyDocument,
	NOT_FOUND_ERROR,
	UNAUTHORIZED_ERROR,
	wrongStoreLicenseKeyDocument,
} from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { validateLicenseKey } from "./license-key.js";

const LICENSE_KEY_ID = "700";
const FUTURE_DATE = "2099-12-31T23:59:59Z";

type LicenseKeyReply = typeof activeLicenseKeyDocument;

const createLicenseKeyReply = (
	overrides: Partial<LicenseKeyReply["data"]["attributes"]>,
): LicenseKeyReply => ({
	data: {
		...activeLicenseKeyDocument.data,
		attributes: { ...activeLicenseKeyDocument.data.attributes, ...overrides },
	},
});

const checkLicenseKeyReply = (reply: unknown, status = 200) => {
	const http = makeHttp([
		route(`/v1/license-keys/${LICENSE_KEY_ID}`, reply, status),
	]);
	return validateLicenseKey(http, "test", {
		storeId: "42",
		licenseKeyId: LICENSE_KEY_ID,
	});
};

describe("validateLicenseKey", () => {
	test("passes an active key under its activation limit and describes its target", async () => {
		const reply = activeLicenseKeyDocument;

		const report = await checkLicenseKeyReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toHaveLength(0);
		expect(report.resource?.key_short).toBe("XXXX-XXXX");
		expect(report.target).toEqual({ label: "XXXX-XXXX", id: LICENSE_KEY_ID });
	});

	test("reports LICENSE_KEY_NOT_FOUND when the key does not exist", async () => {
		const reply = NOT_FOUND_ERROR;

		const report = await checkLicenseKeyReply(reply, 404);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([{ code: "LICENSE_KEY_NOT_FOUND" }]);
		expect(report.target).toEqual({
			label: `license key ${LICENSE_KEY_ID}`,
			id: LICENSE_KEY_ID,
		});
	});

	test("reports AUTH_FAILED when the key is rejected", async () => {
		const reply = UNAUTHORIZED_ERROR;

		const report = await checkLicenseKeyReply(reply, 401);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([{ code: "AUTH_FAILED" }]);
	});

	test("flags a disabled key as an error", async () => {
		const reply = disabledLicenseKeyDocument;

		const report = await checkLicenseKeyReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "LICENSE_KEY_DISABLED", severity: "error" },
		]);
	});

	test("flags an expired key as an error", async () => {
		const reply = expiredLicenseKeyDocument;

		const report = await checkLicenseKeyReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "LICENSE_KEY_EXPIRED", severity: "error" },
		]);
	});

	test("accepts a key that expires in the future or never", async () => {
		const neverExpiresReply = createLicenseKeyReply({ expires_at: null });
		const futureExpiryReply = createLicenseKeyReply({
			expires_at: FUTURE_DATE,
		});

		const neverExpiresReport = await checkLicenseKeyReply(neverExpiresReply);
		const futureExpiryReport = await checkLicenseKeyReply(futureExpiryReply);

		expect(neverExpiresReport.findings).toHaveLength(0);
		expect(futureExpiryReport.findings).toHaveLength(0);
	});

	test("warns when the key is at its activation limit", async () => {
		const reply = atLimitLicenseKeyDocument;

		const report = await checkLicenseKeyReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "LICENSE_KEY_AT_ACTIVATION_LIMIT", severity: "warning" },
		]);
	});

	test("warns when the key is over its activation limit", async () => {
		const reply = createLicenseKeyReply({
			activation_limit: 3,
			instances_count: 5,
		});

		const report = await checkLicenseKeyReply(reply);

		expect(report.findings).toMatchObject([
			{ code: "LICENSE_KEY_AT_ACTIVATION_LIMIT" },
		]);
	});

	test("accepts a key with no activation limit", async () => {
		const reply = createLicenseKeyReply({
			activation_limit: null,
			instances_count: 50,
		});

		const report = await checkLicenseKeyReply(reply);

		expect(report.findings).toHaveLength(0);
	});

	test("flags a key from another store as an error", async () => {
		const reply = wrongStoreLicenseKeyDocument;

		const report = await checkLicenseKeyReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "LICENSE_KEY_STORE_MISMATCH", severity: "error" },
		]);
	});
});
