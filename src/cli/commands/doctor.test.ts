import {
	activeLicenseKeyDoc,
	publishedDiscountDoc,
	publishedProductDoc,
	storesCollection,
	subscriptionVariantDoc,
	unauthorizedError,
	userDoc,
	variantsCollectionPublished,
	webhooksCollectionComplete,
} from "@e2e/fixtures/sandbox/data.js";
import { createMockFetch, pathIs, pathIsWithQuery } from "@e2e/mock-fetch.js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ENV_KEYS } from "@/shared/config.js";
import { runDoctorCommand } from "./doctor.js";

beforeEach(() => {
	vi.stubEnv(ENV_KEYS.apiKey, "k_test_abc");
});

afterEach(() => {
	vi.restoreAllMocks();
});

test("runDoctorCommand returns exit code 0 when every validator passes for an explicit store id", async () => {
	const { fetch } = createMockFetch([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
		{
			match: pathIs("/v1/stores/42"),
			status: 200,
			body: { data: storesCollection.data[0] },
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
		{
			match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
			status: 200,
			body: variantsCollectionPublished,
		},
	]);
	vi.stubGlobal("fetch", fetch);
	const stdout = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);

	const code = await runDoctorCommand({
		mode: "test",
		storeIds: ["42"],
		productId: "100",
		json: true,
		isInteractive: false,
	});

	expect(code).toBe(0);
	const firstCall = stdout.mock.calls[0]?.[0];
	const isFirstCallText = typeof firstCall === "string";
	const payload = JSON.parse(isFirstCallText ? firstCall : "{}");
	expect(payload.ok).toBe(true);
	expect(Array.isArray(payload.reports)).toBe(true);
	expect(payload.reports).toHaveLength(1);
	expect(payload.reports[0].results).toHaveLength(3);
});

test("runDoctorCommand runs against every reachable store when --all-stores is set", async () => {
	const multi = {
		data: [
			{ type: "stores", id: "42", attributes: { name: "A", slug: "a" } },
			{ type: "stores", id: "43", attributes: { name: "B", slug: "b" } },
		],
	};
	const { fetch } = createMockFetch([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: multi },
		{
			match: pathIs("/v1/stores/42"),
			status: 200,
			body: { data: multi.data[0] },
		},
		{
			match: pathIs("/v1/stores/43"),
			status: 200,
			body: { data: multi.data[1] },
		},
	]);
	vi.stubGlobal("fetch", fetch);
	const stdout = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);

	const code = await runDoctorCommand({
		mode: "test",
		allStores: true,
		json: true,
		isInteractive: false,
	});

	expect(code).toBe(0);
	const payload = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "{}"));
	expect(payload.reports).toHaveLength(2);
});

test("runDoctorCommand discovers and validates all resource targets when --all-resources is set", async () => {
	const { fetch } = createMockFetch([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
		{
			match: pathIsWithQuery("/v1/products", { "filter[store_id]": "42" }),
			status: 200,
			body: { data: [publishedProductDoc.data] },
		},
		{
			match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status: 200,
			body: webhooksCollectionComplete,
		},
		{
			match: pathIsWithQuery("/v1/discounts", { "filter[store_id]": "42" }),
			status: 200,
			body: { data: [publishedDiscountDoc.data] },
		},
		{
			match: pathIsWithQuery("/v1/license-keys", { "filter[store_id]": "42" }),
			status: 200,
			body: { data: [activeLicenseKeyDoc.data] },
		},
		{
			match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
			status: 200,
			body: { data: [subscriptionVariantDoc.data] },
		},
		{
			match: pathIs("/v1/stores/42"),
			status: 200,
			body: { data: storesCollection.data[0] },
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
		{
			match: pathIs("/v1/discounts/600"),
			status: 200,
			body: publishedDiscountDoc,
		},
		{
			match: pathIs("/v1/license-keys/700"),
			status: 200,
			body: activeLicenseKeyDoc,
		},
		{
			match: pathIs("/v1/variants/800"),
			status: 200,
			body: subscriptionVariantDoc,
		},
	]);
	vi.stubGlobal("fetch", fetch);
	const stdout = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);

	const code = await runDoctorCommand({
		mode: "test",
		storeIds: ["42"],
		allResources: true,
		json: true,
		isInteractive: false,
	});

	expect(code).toBe(0);
	const payload = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "{}"));
	const names = payload.reports[0].results.map(
		(validation: { name: string }) => validation.name,
	);
	expect(names).toEqual([
		"connection",
		"store",
		"product",
		"webhook",
		"discount",
		"licenseKey",
		"subscriptionPlan",
	]);
});

test("runDoctorCommand falls back to connection-only when non-interactive and no store flag", async () => {
	const { fetch } = createMockFetch([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
	]);
	vi.stubGlobal("fetch", fetch);
	const stdout = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);

	const code = await runDoctorCommand({
		mode: "test",
		json: true,
		isInteractive: false,
	});

	expect(code).toBe(0);
	const payload = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "{}"));
	expect(payload.reports).toHaveLength(1);
	expect(payload.reports[0].results).toHaveLength(1);
	expect(payload.reports[0].results[0].name).toBe("connection");
});

test("runDoctorCommand returns exit code 1 when auth fails", async () => {
	const { fetch } = createMockFetch([
		{ match: pathIs("/v1/users/me"), status: 401, body: unauthorizedError },
	]);
	vi.stubGlobal("fetch", fetch);
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	vi.spyOn(process.stderr, "write").mockImplementation(() => true);

	const code = await runDoctorCommand({
		mode: "test",
		json: true,
		isInteractive: false,
	});
	expect(code).toBe(1);
});

test("runDoctorCommand returns exit code 2 when config throws (e.g. no API key)", async () => {
	vi.stubEnv(ENV_KEYS.apiKey, undefined);
	const stderr = vi
		.spyOn(process.stderr, "write")
		.mockImplementation(() => true);

	const code = await runDoctorCommand({ mode: "test", isInteractive: false });
	expect(code).toBe(2);
	const message = String(stderr.mock.calls[0]?.[0] ?? "");
	expect(message).toContain("fresh-squeezy init");
	expect(message).toContain(ENV_KEYS.apiKey);
});
