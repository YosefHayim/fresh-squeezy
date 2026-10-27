import { afterEach, describe, expect, test, vi } from "vitest";
import {
	activateLicense,
	deactivateLicense,
	validateLicense,
} from "./license-api.js";

const LICENSE_KEY = "38b1460a-5104-4067-a91d-77b872934d51";
const INSTANCE_ID = "f90ec370-fd83-46a5-8bbd-44a241e78665";

const ACTIVATED_REPLY = { activated: true, error: null };
const LIMIT_REACHED_REPLY = {
	activated: false,
	error: "This license key has reached the activation limit.",
};
const NOT_FOUND_REPLY = { valid: false, error: "license_key not found." };

const stubFetch = (status: number, replyString: string) => {
	const fetchStub = vi.fn(
		async (_url: URL | string, _init: RequestInit) =>
			new Response(replyString, { status }),
	);
	vi.stubGlobal("fetch", fetchStub);
	return fetchStub;
};

const readLastRequest = (fetchStub: ReturnType<typeof stubFetch>) => {
	const lastCall = fetchStub.mock.lastCall;
	const isThereNoCall = lastCall === undefined;
	if (isThereNoCall) throw new Error("fetch was not called");
	const [url, init] = lastCall;
	const headers = new Headers(init.headers);
	const form = new URLSearchParams(String(init.body));
	return { url: new URL(url), method: init.method, headers, form };
};

afterEach(() => {
	vi.unstubAllGlobals();
});

const ACTIVATE_REQUEST = { licenseKey: LICENSE_KEY, instanceName: "Laptop" };

describe("activateLicense", () => {
	test("posts the key and instance name as a form without an API key", async () => {
		const fetchStub = stubFetch(200, JSON.stringify(ACTIVATED_REPLY));

		const activation = await activateLicense(ACTIVATE_REQUEST);

		const { url, method, headers, form } = readLastRequest(fetchStub);
		expect(url.toString()).toBe(
			"https://api.lemonsqueezy.com/v1/licenses/activate",
		);
		expect(method).toBe("POST");
		expect(headers.get("accept")).toBe("application/json");
		expect(headers.has("authorization")).toBe(false);
		expect(Object.fromEntries(form)).toEqual({
			license_key: LICENSE_KEY,
			instance_name: "Laptop",
		});
		expect(activation.activated).toBe(true);
	});

	test("returns a 4xx answer with a JSON body and its error", async () => {
		stubFetch(400, JSON.stringify(LIMIT_REACHED_REPLY));

		const activation = await activateLicense(ACTIVATE_REQUEST);

		expect(activation.activated).toBe(false);
		expect(activation.error).toBe(LIMIT_REACHED_REPLY.error);
	});

	test("throws a FreshSqueezyError when the answer has no JSON body", async () => {
		stubFetch(502, "Bad Gateway");

		const failure = activateLicense(ACTIVATE_REQUEST);

		await expect(failure).rejects.toMatchObject({
			name: "FreshSqueezyError",
			code: "HTTP_502",
			status: 502,
		});
	});
});

describe("validateLicense", () => {
	test("sends the instance id when it is given", async () => {
		const fetchStub = stubFetch(
			200,
			JSON.stringify({ valid: true, error: null }),
		);

		await validateLicense({ licenseKey: LICENSE_KEY, instanceId: INSTANCE_ID });

		const { url, form } = readLastRequest(fetchStub);
		expect(url.pathname).toBe("/v1/licenses/validate");
		expect(Object.fromEntries(form)).toEqual({
			license_key: LICENSE_KEY,
			instance_id: INSTANCE_ID,
		});
	});

	test("leaves instance_id out when there is none", async () => {
		const fetchStub = stubFetch(
			200,
			JSON.stringify({ valid: true, error: null }),
		);

		await validateLicense({ licenseKey: LICENSE_KEY });

		const { form } = readLastRequest(fetchStub);
		expect(Object.fromEntries(form)).toEqual({ license_key: LICENSE_KEY });
	});

	test("returns a 404 for an unknown key with no license_key or meta", async () => {
		stubFetch(404, JSON.stringify(NOT_FOUND_REPLY));

		const validation = await validateLicense({ licenseKey: LICENSE_KEY });

		expect(validation.valid).toBe(false);
		expect(validation.error).toBe(NOT_FOUND_REPLY.error);
		expect(validation.license_key).toBeUndefined();
		expect(validation.meta).toBeUndefined();
	});

	test("throws a FreshSqueezyError on a network failure", async () => {
		vi.stubGlobal("fetch", async () => {
			throw new Error("offline");
		});

		const failure = validateLicense({ licenseKey: LICENSE_KEY });

		await expect(failure).rejects.toMatchObject({
			name: "FreshSqueezyError",
			code: "NETWORK_ERROR",
			message: "offline",
		});
	});
});

describe("deactivateLicense", () => {
	test("posts the key and instance id", async () => {
		const fetchStub = stubFetch(
			200,
			JSON.stringify({ deactivated: true, error: null }),
		);

		const deactivation = await deactivateLicense({
			licenseKey: LICENSE_KEY,
			instanceId: INSTANCE_ID,
		});

		const { url, method, form } = readLastRequest(fetchStub);
		expect(url.pathname).toBe("/v1/licenses/deactivate");
		expect(method).toBe("POST");
		expect(Object.fromEntries(form)).toEqual({
			license_key: LICENSE_KEY,
			instance_id: INSTANCE_ID,
		});
		expect(deactivation.deactivated).toBe(true);
	});
});
