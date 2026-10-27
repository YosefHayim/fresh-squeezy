import {
	activeLicenseKeyDoc,
	NOT_FOUND_ERROR,
	PUBLISHED_PRODUCT_DOC,
	publishedDiscountDoc,
	STORE_DOC,
	subscriptionVariantDoc,
	UNAUTHORIZED_ERROR,
	WEBHOOKS_COLLECTION_COMPLETE,
} from "@e2e/fixtures/sandbox/data.js";
import {
	makeHttp,
	route,
	SIGNED_IN_ROUTES,
	storeListRoute,
	variantListRoute,
} from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { doctor, listStoreIds } from "./doctor.js";

test("doctor skips validators for targets that are not configured", async () => {
	const http = makeHttp(SIGNED_IN_ROUTES);

	const report = await doctor(http, "test");

	expect(report.results).toHaveLength(1);
	expect(report.results[0]?.name).toBe("connection");
});

const STORE_SCOPED_ROUTES = [
	...SIGNED_IN_ROUTES,
	route("/v1/stores/42", STORE_DOC),
];

const TARGET_CASES = [
	{
		title: "discount validator when discountId is provided",
		routes: [route("/v1/discounts/600", publishedDiscountDoc)],
		options: { discountIds: ["600"] },
		name: "discount",
	},
	{
		title: "license key validator when licenseKeyId is provided",
		routes: [route("/v1/license-keys/700", activeLicenseKeyDoc)],
		options: { licenseKeyIds: ["700"] },
		name: "licenseKey",
	},
	{
		title: "subscription plan validator when variantId is provided",
		routes: [
			route("/v1/variants/800", subscriptionVariantDoc),
			route("/v1/products/100", PUBLISHED_PRODUCT_DOC),
		],
		options: { variantIds: ["800"] },
		name: "subscriptionPlan",
	},
];

test.each(TARGET_CASES)(
	"doctor runs $title",
	async ({ routes, options, name }) => {
		const http = makeHttp([...STORE_SCOPED_ROUTES, ...routes]);

		const report = await doctor(http, "test", { storeId: "42", ...options });

		expect(report.ok).toBe(true);
		expect(report.results.some((entry) => entry.name === name)).toBe(true);
	},
);

test("doctor includes discount failure in overall ok", async () => {
	const http = makeHttp([
		...STORE_SCOPED_ROUTES,
		route("/v1/discounts/9999", UNAUTHORIZED_ERROR, 404),
	]);

	const report = await doctor(http, "test", {
		storeId: "42",
		discountIds: ["9999"],
	});

	expect(report.ok).toBe(false);
	expect(
		report.results.some((entry) => entry.name === "discount" && !entry.ok),
	).toBe(true);
});

test("doctor stops after a failed connection", async () => {
	const http = makeHttp([route("/v1/users/me", UNAUTHORIZED_ERROR, 401)]);

	const report = await doctor(http, "test", {
		storeId: "42",
		discountIds: ["600"],
	});

	expect(report.ok).toBe(false);
	expect(report.results.map((entry) => entry.name)).toEqual(["connection"]);
});

test("doctor throws DOCTOR_OPTIONS_INVALID when dependent options come without a store", async () => {
	const http = makeHttp(SIGNED_IN_ROUTES);

	await expect(
		doctor(http, "test", { discountIds: ["600"] }),
	).rejects.toMatchObject({
		code: "DOCTOR_OPTIONS_INVALID",
	});
	await expect(
		doctor(http, "test", { allResources: true }),
	).rejects.toMatchObject({
		code: "DOCTOR_OPTIONS_INVALID",
	});
});

test("doctor runs each explicit id once", async () => {
	const http = makeHttp([
		...STORE_SCOPED_ROUTES,
		route("/v1/discounts/600", publishedDiscountDoc),
	]);

	const report = await doctor(http, "test", {
		storeId: "42",
		discountIds: ["600", "600"],
	});

	const discountResults = report.results.filter(
		(entry) => entry.name === "discount",
	);
	expect(discountResults).toHaveLength(1);
});

const DISCOVERY_ROUTES = [
	...STORE_SCOPED_ROUTES,
	storeListRoute("products", { data: [PUBLISHED_PRODUCT_DOC.data] }),
	storeListRoute("webhooks", WEBHOOKS_COLLECTION_COMPLETE),
	storeListRoute("discounts", { data: [publishedDiscountDoc.data] }),
	storeListRoute("license-keys", { data: [activeLicenseKeyDoc.data] }),
	variantListRoute("100", { data: [subscriptionVariantDoc.data] }),
	route("/v1/products/100", PUBLISHED_PRODUCT_DOC),
	route("/v1/variants/800", subscriptionVariantDoc),
	route("/v1/discounts/600", publishedDiscountDoc),
	route("/v1/license-keys/700", activeLicenseKeyDoc),
];

test("doctor with allResources checks everything it finds in the store", async () => {
	const http = makeHttp(DISCOVERY_ROUTES);

	const report = await doctor(http, "test", {
		storeId: "42",
		allResources: true,
	});

	const names = report.results.map((entry) => entry.name);
	expect(report.ok).toBe(true);
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

test("doctor with allResources reports a failed listing as a failed check", async () => {
	const http = makeHttp([
		{ ...storeListRoute("products", NOT_FOUND_ERROR), status: 500 },
		...DISCOVERY_ROUTES,
	]);

	const report = await doctor(http, "test", {
		storeId: "42",
		allResources: true,
	});

	const listingFailure = report.results.find(
		(entry) => entry.target?.label === "products of store 42",
	);
	expect(report.ok).toBe(false);
	expect(listingFailure?.name).toBe("product");
	expect(listingFailure?.ok).toBe(false);
});

test("listStoreIds returns every store id", async () => {
	const http = makeHttp(SIGNED_IN_ROUTES);

	const storeIds = await listStoreIds(http);

	expect(storeIds).toEqual(["42"]);
});

test("listStoreIds throws NO_STORES when the key reaches no store", async () => {
	const http = makeHttp([route("/v1/stores", { data: [] })]);

	await expect(listStoreIds(http)).rejects.toMatchObject({ code: "NO_STORES" });
});

test("listStoreIds throws AUTH_FAILED when the key is rejected", async () => {
	const http = makeHttp([route("/v1/stores", UNAUTHORIZED_ERROR, 401)]);

	await expect(listStoreIds(http)).rejects.toMatchObject({
		code: "AUTH_FAILED",
		message: "API key rejected by Lemon Squeezy.",
	});
});
