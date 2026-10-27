import { afterEach, expect, test, vi } from "vitest";
import { isFreshSqueezyError } from "@/client/errors.js";
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

const stubFetch = (status: number, replyText: string) => {
	const fetchStub = vi.fn(async () => new Response(replyText, { status }));
	vi.stubGlobal("fetch", fetchStub);
	return fetchStub;
};

const readLastRequest = (fetchStub: ReturnType<typeof stubFetch>) => {
	const [url, init] = fetchStub.mock.calls[0] as unknown as [URL, RequestInit];
	const headers = new Headers(init.headers);
	const form = new URLSearchParams(String(init.body));
	return { url, method: init.method, headers, form };
};

afterEach(() => {
	vi.unstubAllGlobals();
});

test("activateLicense posts the key and instance name as a form without an API key", async () => {
	const fetchStub = stubFetch(200, JSON.stringify(ACTIVATED_REPLY));

	const activation = await activateLicense({
		licenseKey: LICENSE_KEY,
		instanceName: "Laptop",
	});

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

test("validateLicense sends the instance id when it is given", async () => {
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

test("validateLicense leaves instance_id out when there is none", async () => {
	const fetchStub = stubFetch(
		200,
		JSON.stringify({ valid: true, error: null }),
	);

	await validateLicense({ licenseKey: LICENSE_KEY });

	const { form } = readLastRequest(fetchStub);
	expect(Object.fromEntries(form)).toEqual({ license_key: LICENSE_KEY });
});

test("deactivateLicense posts the key and instance id", async () => {
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

test("a 4xx answer with a JSON body is returned with its error", async () => {
	stubFetch(400, JSON.stringify(LIMIT_REACHED_REPLY));

	const activation = await activateLicense({
		licenseKey: LICENSE_KEY,
		instanceName: "Laptop",
	});

	expect(activation.activated).toBe(false);
	expect(activation.error).toBe(LIMIT_REACHED_REPLY.error);
});

test("a 404 for an unknown key comes back with no license_key or meta", async () => {
	stubFetch(404, JSON.stringify(NOT_FOUND_REPLY));

	const validation = await validateLicense({ licenseKey: LICENSE_KEY });

	expect(validation.valid).toBe(false);
	expect(validation.error).toBe(NOT_FOUND_REPLY.error);
	expect(validation.license_key).toBeUndefined();
	expect(validation.meta).toBeUndefined();
});

test("an answer with no JSON body throws a FreshSqueezyError", async () => {
	stubFetch(502, "Bad Gateway");

	const failure = await activateLicense({
		licenseKey: LICENSE_KEY,
		instanceName: "Laptop",
	}).catch((error: unknown) => error);

	expect(isFreshSqueezyError(failure)).toBe(true);
	expect(failure).toMatchObject({ code: "HTTP_502", status: 502 });
});

test("a network failure throws a FreshSqueezyError", async () => {
	vi.stubGlobal("fetch", async () => {
		throw new Error("offline");
	});

	const failure = await validateLicense({ licenseKey: LICENSE_KEY }).catch(
		(error: unknown) => error,
	);

	expect(failure).toMatchObject({ code: "NETWORK_ERROR", message: "offline" });
});
