import {
	makeHttp,
	route,
	SIGNED_IN_ROUTES,
	storeListRoute,
	variantListRoute,
} from "@e2e/mock-fetch.js";
import {
	activeLicenseKeyDoc,
	NOT_FOUND_ERROR,
	nonSubscriptionVariantDoc,
	PUBLISHED_PRODUCT_DOC,
	publishedDiscountDoc,
	STORE_DOC,
	subscriptionVariantDoc,
	UNAUTHORIZED_ERROR,
	WEBHOOKS_COLLECTION_COMPLETE,
} from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { doctor, listStoreIds } from "./doctor.js";
import type { DoctorReport } from "./findings.js";

const WEBHOOK_URL = "https://app.example.com/api/webhooks/lemon-squeezy";

const STORE_SCOPED_ROUTES = [
	...SIGNED_IN_ROUTES,
	route("/v1/stores/42", STORE_DOC),
];

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

const listCheckNames = (report: DoctorReport) =>
	report.checks.map((check) => check.name);

const TARGET_CASES = [
	{
		title: "a product check when productIds is given",
		routes: [route("/v1/products/100", PUBLISHED_PRODUCT_DOC)],
		targets: { productIds: ["100"] },
		name: "product",
	},
	{
		title: "a webhook check when webhookUrls is given",
		routes: [storeListRoute("webhooks", WEBHOOKS_COLLECTION_COMPLETE)],
		targets: { webhookUrls: [WEBHOOK_URL] },
		name: "webhook",
	},
	{
		title: "a discount check when discountIds is given",
		routes: [route("/v1/discounts/600", publishedDiscountDoc)],
		targets: { discountIds: ["600"] },
		name: "discount",
	},
	{
		title: "a license key check when licenseKeyIds is given",
		routes: [route("/v1/license-keys/700", activeLicenseKeyDoc)],
		targets: { licenseKeyIds: ["700"] },
		name: "licenseKey",
	},
	{
		title: "a subscription plan check when variantIds is given",
		routes: [
			route("/v1/variants/800", subscriptionVariantDoc),
			route("/v1/products/100", PUBLISHED_PRODUCT_DOC),
		],
		targets: { variantIds: ["800"] },
		name: "subscriptionPlan",
	},
];

const DEPENDENT_TARGET_CASES = [
	{ targetName: "allResources", targets: { allResources: true } },
	{ targetName: "productIds", targets: { productIds: ["100"] } },
	{ targetName: "variantIds", targets: { variantIds: ["800"] } },
	{ targetName: "webhookUrls", targets: { webhookUrls: [WEBHOOK_URL] } },
	{ targetName: "discountIds", targets: { discountIds: ["600"] } },
	{ targetName: "licenseKeyIds", targets: { licenseKeyIds: ["700"] } },
];

const LISTING_CASES = [
	{
		collection: "products",
		label: "products of store 42",
		name: "product",
	},
	{
		collection: "webhooks",
		label: "webhooks of store 42",
		name: "webhook",
	},
	{
		collection: "discounts",
		label: "discounts of store 42",
		name: "discount",
	},
	{
		collection: "license-keys",
		label: "license keys of store 42",
		name: "licenseKey",
	},
] as const;

describe("doctor", () => {
	test("runs only the connection check when no store is given", async () => {
		const http = makeHttp(SIGNED_IN_ROUTES);

		const report = await doctor(http, "test");

		expect(report.ok).toBe(true);
		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test("runs the connection and store checks when only a store is given", async () => {
		const http = makeHttp(STORE_SCOPED_ROUTES);

		const report = await doctor(http, "test", { storeId: "42" });

		expect(report.ok).toBe(true);
		expect(listCheckNames(report)).toEqual(["connection", "store"]);
	});

	test.each(TARGET_CASES)("runs $title", async ({ routes, targets, name }) => {
		const http = makeHttp([...STORE_SCOPED_ROUTES, ...routes]);

		const report = await doctor(http, "test", { storeId: "42", ...targets });

		expect(report.ok).toBe(true);
		expect(listCheckNames(report)).toContain(name);
	});

	test("fails the report when a target check fails", async () => {
		const http = makeHttp([
			...STORE_SCOPED_ROUTES,
			route("/v1/discounts/9999", NOT_FOUND_ERROR, 404),
		]);

		const report = await doctor(http, "test", {
			storeId: "42",
			discountIds: ["9999"],
		});

		const discountCheck = report.checks.find(
			(check) => check.name === "discount",
		);
		expect(report.ok).toBe(false);
		expect(discountCheck?.ok).toBe(false);
	});

	test("stops after a failed connection even when targets are given", async () => {
		const http = makeHttp([route("/v1/users/me", UNAUTHORIZED_ERROR, 401)]);

		const report = await doctor(http, "test", {
			storeId: "42",
			discountIds: ["600"],
		});

		expect(report.ok).toBe(false);
		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test("fails the report when the connection fails and no store is given", async () => {
		const http = makeHttp([route("/v1/users/me", UNAUTHORIZED_ERROR, 401)]);

		const report = await doctor(http, "test");

		expect(report.ok).toBe(false);
		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test.each(DEPENDENT_TARGET_CASES)(
		"throws DOCTOR_TARGETS_INVALID when $targetName comes without a store",
		async ({ targetName, targets }) => {
			const http = makeHttp(SIGNED_IN_ROUTES);

			const failedDoctor = doctor(http, "test", targets);

			await expect(failedDoctor).rejects.toMatchObject({
				code: "DOCTOR_TARGETS_INVALID",
				message: expect.stringContaining(targetName),
			});
		},
	);

	test("accepts empty target lists without a store", async () => {
		const http = makeHttp(SIGNED_IN_ROUTES);

		const report = await doctor(http, "test", {
			allResources: false,
			productIds: [],
			discountIds: [],
		});

		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test("runs each explicit id once", async () => {
		const http = makeHttp([
			...STORE_SCOPED_ROUTES,
			route("/v1/discounts/600", publishedDiscountDoc),
		]);

		const report = await doctor(http, "test", {
			storeId: "42",
			discountIds: ["600", "600"],
		});

		const discountChecks = report.checks.filter(
			(check) => check.name === "discount",
		);
		expect(discountChecks).toHaveLength(1);
	});

	test("checks everything it finds in the store with allResources", async () => {
		const http = makeHttp(DISCOVERY_ROUTES);

		const report = await doctor(http, "test", {
			storeId: "42",
			allResources: true,
		});

		expect(report.ok).toBe(true);
		expect(listCheckNames(report)).toEqual([
			"connection",
			"store",
			"product",
			"webhook",
			"discount",
			"licenseKey",
			"subscriptionPlan",
		]);
	});

	test("runs a discovered id once when it is also given explicitly", async () => {
		const http = makeHttp(DISCOVERY_ROUTES);

		const report = await doctor(http, "test", {
			storeId: "42",
			allResources: true,
			discountIds: ["600"],
			webhookUrls: [WEBHOOK_URL],
		});

		const discountChecks = report.checks.filter(
			(check) => check.name === "discount",
		);
		const webhookChecks = report.checks.filter(
			(check) => check.name === "webhook",
		);
		expect(discountChecks).toHaveLength(1);
		expect(webhookChecks).toHaveLength(1);
	});

	test("skips discovered variants that are not subscriptions", async () => {
		const http = makeHttp([
			variantListRoute("100", { data: [nonSubscriptionVariantDoc.data] }),
			...DISCOVERY_ROUTES,
		]);

		const report = await doctor(http, "test", {
			storeId: "42",
			allResources: true,
		});

		expect(listCheckNames(report)).not.toContain("subscriptionPlan");
	});

	test.each(LISTING_CASES)(
		"reports a failed $collection listing as a failed check",
		async ({ collection, label, name }) => {
			const http = makeHttp([
				{ ...storeListRoute(collection, NOT_FOUND_ERROR), status: 500 },
				...DISCOVERY_ROUTES,
			]);

			const report = await doctor(http, "test", {
				storeId: "42",
				allResources: true,
			});

			const listingFailure = report.checks.find(
				(check) => check.target?.label === label,
			);
			expect(report.ok).toBe(false);
			expect(listingFailure?.name).toBe(name);
			expect(listingFailure?.ok).toBe(false);
		},
	);

	test("reports a failed variant listing and still checks the rest", async () => {
		const http = makeHttp([
			{ ...variantListRoute("100", NOT_FOUND_ERROR), status: 500 },
			...DISCOVERY_ROUTES,
		]);

		const report = await doctor(http, "test", {
			storeId: "42",
			allResources: true,
		});

		const listingFailure = report.checks.find(
			(check) =>
				check.target?.label === "plans of product 100, listed for of store 42",
		);
		expect(report.ok).toBe(false);
		expect(listingFailure?.name).toBe("subscriptionPlan");
		expect(listCheckNames(report)).toContain("discount");
	});
});

describe("listStoreIds", () => {
	test("lists every store id", async () => {
		const http = makeHttp(SIGNED_IN_ROUTES);

		const storeIds = await listStoreIds(http);

		expect(storeIds).toEqual(["42"]);
	});

	test("throws NO_STORES when the key reaches no store", async () => {
		const http = makeHttp([route("/v1/stores", { data: [] })]);

		const failedListing = listStoreIds(http);

		await expect(failedListing).rejects.toMatchObject({ code: "NO_STORES" });
	});

	test("throws AUTH_FAILED when the key is rejected", async () => {
		const http = makeHttp([route("/v1/stores", UNAUTHORIZED_ERROR, 401)]);

		const failedListing = listStoreIds(http);

		await expect(failedListing).rejects.toMatchObject({
			code: "AUTH_FAILED",
			message: "API key rejected by Lemon Squeezy.",
		});
	});
});
