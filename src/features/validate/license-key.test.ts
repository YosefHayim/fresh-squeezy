import {
	activeLicenseKeyDoc,
	atLimitLicenseKeyDoc,
	disabledLicenseKeyDoc,
	expiredLicenseKeyDoc,
	notFoundError,
	wrongStoreLicenseKeyDoc,
} from "@e2e/fixtures/sandbox/data.js";
import { makeClient, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateLicenseKey } from "./license-key.js";

test("validateLicenseKey returns ok for an active license key under its activation limit", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/700"),
			status: 200,
			body: activeLicenseKeyDoc,
		},
	]);
	const licenseKeyValidation = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 700,
	});
	expect(licenseKeyValidation.ok).toBe(true);
	expect(licenseKeyValidation.resource?.key_short).toBe("XXXX-XXXX");
	expect(licenseKeyValidation.issues).toHaveLength(0);
});

test("validateLicenseKey returns LICENSE_KEY_NOT_FOUND on 404", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/9999"),
			status: 404,
			body: notFoundError,
		},
	]);
	const licenseKeyValidation = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 9999,
	});
	expect(licenseKeyValidation.ok).toBe(false);
	expect(licenseKeyValidation.issues[0]?.code).toBe("LICENSE_KEY_NOT_FOUND");
});

test("validateLicenseKey returns LICENSE_KEY_DISABLED for disabled keys", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/701"),
			status: 200,
			body: disabledLicenseKeyDoc,
		},
	]);
	const licenseKeyValidation = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 701,
	});
	expect(licenseKeyValidation.ok).toBe(false);
	expect(licenseKeyValidation.issues[0]?.code).toBe("LICENSE_KEY_DISABLED");
});

test("validateLicenseKey returns LICENSE_KEY_EXPIRED for past expires_at", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/702"),
			status: 200,
			body: expiredLicenseKeyDoc,
		},
	]);
	const licenseKeyValidation = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 702,
	});
	expect(licenseKeyValidation.ok).toBe(false);
	expect(licenseKeyValidation.issues[0]?.code).toBe("LICENSE_KEY_EXPIRED");
});

test("validateLicenseKey returns LICENSE_KEY_AT_ACTIVATION_LIMIT when instances >= limit", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/703"),
			status: 200,
			body: atLimitLicenseKeyDoc,
		},
	]);
	const licenseKeyValidation = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 703,
	});
	expect(licenseKeyValidation.ok).toBe(true);
	expect(licenseKeyValidation.issues[0]?.code).toBe(
		"LICENSE_KEY_AT_ACTIVATION_LIMIT",
	);
	expect(licenseKeyValidation.issues[0]?.severity).toBe("warning");
});

test("validateLicenseKey returns LICENSE_KEY_STORE_MISMATCH for wrong store", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/704"),
			status: 200,
			body: wrongStoreLicenseKeyDoc,
		},
	]);
	const licenseKeyValidation = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 704,
	});
	expect(licenseKeyValidation.ok).toBe(false);
	expect(licenseKeyValidation.issues[0]?.code).toBe(
		"LICENSE_KEY_STORE_MISMATCH",
	);
});
