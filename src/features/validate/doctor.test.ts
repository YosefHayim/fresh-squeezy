import {
	activeLicenseKeyDoc,
	publishedDiscountDoc,
	publishedProductDoc,
	storeDoc,
	storesCollection,
	subscriptionVariantDoc,
	unauthorizedError,
	userDoc,
} from "@e2e/fixtures/sandbox/data.js";
import { makeClient, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { doctor } from "./doctor.js";

test("doctor skips validators for targets that are not configured", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
	]);

	const report = await doctor(http, "test");

	expect(report.results).toHaveLength(1);
	expect(report.results[0]?.name).toBe("connection");
});

test("doctor runs discount validator when discountId is provided", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
		{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
		{
			match: pathIs("/v1/discounts/600"),
			status: 200,
			body: publishedDiscountDoc,
		},
	]);

	const report = await doctor(http, "test", {
		storeId: 42,
		discountIds: [600],
	});

	expect(report.ok).toBe(true);
	expect(report.results.some((r) => r.name === "discount")).toBe(true);
});

test("doctor runs license key validator when licenseKeyId is provided", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
		{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
		{
			match: pathIs("/v1/license-keys/700"),
			status: 200,
			body: activeLicenseKeyDoc,
		},
	]);

	const report = await doctor(http, "test", {
		storeId: 42,
		licenseKeyIds: [700],
	});

	expect(report.ok).toBe(true);
	expect(report.results.some((r) => r.name === "licenseKey")).toBe(true);
});

test("doctor runs subscription plan validator when variantId is provided", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
		{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
		{
			match: pathIs("/v1/variants/800"),
			status: 200,
			body: subscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
	]);

	const report = await doctor(http, "test", { storeId: 42, variantIds: [800] });

	expect(report.ok).toBe(true);
	expect(report.results.some((r) => r.name === "subscriptionPlan")).toBe(true);
});

test("doctor includes discount failure in overall ok", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
		{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
		{
			match: pathIs("/v1/discounts/9999"),
			status: 404,
			body: unauthorizedError,
		},
	]);

	const report = await doctor(http, "test", {
		storeId: 42,
		discountIds: [9999],
	});

	expect(report.ok).toBe(false);
	expect(report.results.some((r) => r.name === "discount" && !r.ok)).toBe(true);
});
