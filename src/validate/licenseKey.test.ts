import { expect, test } from "vitest";
import {
	activeLicenseKeyDoc,
	atLimitLicenseKeyDoc,
	disabledLicenseKeyDoc,
	expiredLicenseKeyDoc,
	notFoundError,
	wrongStoreLicenseKeyDoc,
} from "../../tests/fixtures/sandbox/data.js";
import { createMockFetch, pathIs } from "../../tests/helpers/mockFetch.js";
import { resolveConfig } from "../core/config.js";
import { HttpClient } from "../core/http.js";
import { validateLicenseKey } from "./licenseKey.js";

const makeClient = (routes: Parameters<typeof createMockFetch>[0]) => {
	const { fetch } = createMockFetch(routes);
	return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
};

test("validateLicenseKey returns ok for an active license key under its activation limit", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/700"),
			status: 200,
			body: activeLicenseKeyDoc,
		},
	]);
	const result = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 700,
	});
	expect(result.ok).toBe(true);
	expect(result.resource?.key_short).toBe("XXXX-XXXX");
	expect(result.issues).toHaveLength(0);
});

test("validateLicenseKey returns LICENSE_KEY_NOT_FOUND on 404", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/9999"),
			status: 404,
			body: notFoundError,
		},
	]);
	const result = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 9999,
	});
	expect(result.ok).toBe(false);
	expect(result.issues[0]?.code).toBe("LICENSE_KEY_NOT_FOUND");
});

test("validateLicenseKey returns LICENSE_KEY_DISABLED for disabled keys", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/701"),
			status: 200,
			body: disabledLicenseKeyDoc,
		},
	]);
	const result = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 701,
	});
	expect(result.ok).toBe(false);
	expect(result.issues[0]?.code).toBe("LICENSE_KEY_DISABLED");
});

test("validateLicenseKey returns LICENSE_KEY_EXPIRED for past expires_at", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/702"),
			status: 200,
			body: expiredLicenseKeyDoc,
		},
	]);
	const result = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 702,
	});
	expect(result.ok).toBe(false);
	expect(result.issues[0]?.code).toBe("LICENSE_KEY_EXPIRED");
});

test("validateLicenseKey returns LICENSE_KEY_AT_ACTIVATION_LIMIT when instances >= limit", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/703"),
			status: 200,
			body: atLimitLicenseKeyDoc,
		},
	]);
	const result = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 703,
	});
	expect(result.ok).toBe(true);
	expect(result.issues[0]?.code).toBe("LICENSE_KEY_AT_ACTIVATION_LIMIT");
	expect(result.issues[0]?.severity).toBe("warning");
});

test("validateLicenseKey returns LICENSE_KEY_STORE_MISMATCH for wrong store", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/license-keys/704"),
			status: 200,
			body: wrongStoreLicenseKeyDoc,
		},
	]);
	const result = await validateLicenseKey(http, "test", {
		storeId: 42,
		licenseKeyId: 704,
	});
	expect(result.ok).toBe(false);
	expect(result.issues[0]?.code).toBe("LICENSE_KEY_STORE_MISMATCH");
});
