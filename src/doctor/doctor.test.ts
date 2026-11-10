import {
	createTestHttp,
	replyAtPath,
	SIGNED_IN_HANDLERS,
	replyToStoreList,
	replyToVariantList,
} from "@/mock-lemon-squeezy-api.js";
import {
	ACTIVE_LICENSE_KEY_DOCUMENT,
	NOT_FOUND_ERROR,
	NON_SUBSCRIPTION_VARIANT_DOCUMENT,
	PUBLISHED_PRODUCT_DOCUMENT,
	PUBLISHED_DISCOUNT_DOCUMENT,
	STORE_DOCUMENT,
	SUBSCRIPTION_VARIANT_DOCUMENT,
	UNAUTHORIZED_ERROR,
	WEBHOOKS_COLLECTION_COMPLETE,
} from "@/lemon-squeezy-fixtures.js";
import { describe, expect, test } from "vitest";
import { doctor, listStoreIds } from "./doctor.js";
import type { DoctorReport } from "./findings.js";

const WEBHOOK_URL = "https://app.example.com/api/webhooks/lemon-squeezy";

const STORE_SCOPED_HANDLERS = [
	...SIGNED_IN_HANDLERS,
	replyAtPath("/v1/stores/42", STORE_DOCUMENT),
];

const DISCOVERY_HANDLERS = [
	...STORE_SCOPED_HANDLERS,
	replyToStoreList("products", { data: [PUBLISHED_PRODUCT_DOCUMENT.data] }),
	replyToStoreList("webhooks", WEBHOOKS_COLLECTION_COMPLETE),
	replyToStoreList("discounts", { data: [PUBLISHED_DISCOUNT_DOCUMENT.data] }),
	replyToStoreList("license-keys", {
		data: [ACTIVE_LICENSE_KEY_DOCUMENT.data],
	}),
	replyToVariantList("100", { data: [SUBSCRIPTION_VARIANT_DOCUMENT.data] }),
	replyAtPath("/v1/products/100", PUBLISHED_PRODUCT_DOCUMENT),
	replyAtPath("/v1/variants/800", SUBSCRIPTION_VARIANT_DOCUMENT),
	replyAtPath("/v1/discounts/600", PUBLISHED_DISCOUNT_DOCUMENT),
	replyAtPath("/v1/license-keys/700", ACTIVE_LICENSE_KEY_DOCUMENT),
];

const listCheckNames = (report: DoctorReport) =>
	report.checks.map((check) => check.name);

const TARGET_CASES = [
	{
		title: "a product check when productIds is given",
		handlers: [replyAtPath("/v1/products/100", PUBLISHED_PRODUCT_DOCUMENT)],
		targets: { productIds: ["100"] },
		name: "product",
	},
	{
		title: "a webhook check when webhookUrls is given",
		handlers: [replyToStoreList("webhooks", WEBHOOKS_COLLECTION_COMPLETE)],
		targets: { webhookUrls: [WEBHOOK_URL] },
		name: "webhook",
	},
	{
		title: "a discount check when discountIds is given",
		handlers: [replyAtPath("/v1/discounts/600", PUBLISHED_DISCOUNT_DOCUMENT)],
		targets: { discountIds: ["600"] },
		name: "discount",
	},
	{
		title: "a license key check when licenseKeyIds is given",
		handlers: [
			replyAtPath("/v1/license-keys/700", ACTIVE_LICENSE_KEY_DOCUMENT),
		],
		targets: { licenseKeyIds: ["700"] },
		name: "licenseKey",
	},
	{
		title: "a subscription plan check when variantIds is given",
		handlers: [
			replyAtPath("/v1/variants/800", SUBSCRIPTION_VARIANT_DOCUMENT),
			replyAtPath("/v1/products/100", PUBLISHED_PRODUCT_DOCUMENT),
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
		const http = createTestHttp(SIGNED_IN_HANDLERS);

		const report = await doctor(http, "test");

		expect(report.ok).toBe(true);
		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test("runs the connection and store checks when only a store is given", async () => {
		const http = createTestHttp(STORE_SCOPED_HANDLERS);

		const report = await doctor(http, "test", { storeId: "42" });

		expect(report.ok).toBe(true);
		expect(listCheckNames(report)).toEqual(["connection", "store"]);
	});

	test.each(TARGET_CASES)(
		"runs $title",
		async ({ handlers, targets, name }) => {
			const http = createTestHttp([...STORE_SCOPED_HANDLERS, ...handlers]);

			const report = await doctor(http, "test", { storeId: "42", ...targets });

			expect(report.ok).toBe(true);
			expect(listCheckNames(report)).toContain(name);
		},
	);

	test("fails the report when a target check fails", async () => {
		const http = createTestHttp([
			...STORE_SCOPED_HANDLERS,
			replyAtPath("/v1/discounts/9999", NOT_FOUND_ERROR, 404),
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
		const http = createTestHttp([
			replyAtPath("/v1/users/me", UNAUTHORIZED_ERROR, 401),
		]);

		const report = await doctor(http, "test", {
			storeId: "42",
			discountIds: ["600"],
		});

		expect(report.ok).toBe(false);
		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test("fails the report when the connection fails and no store is given", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/users/me", UNAUTHORIZED_ERROR, 401),
		]);

		const report = await doctor(http, "test");

		expect(report.ok).toBe(false);
		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test.each(DEPENDENT_TARGET_CASES)(
		"throws DOCTOR_TARGETS_INVALID when $targetName comes without a store",
		async ({ targetName, targets }) => {
			const http = createTestHttp(SIGNED_IN_HANDLERS);

			const failedDoctor = doctor(http, "test", targets);

			await expect(failedDoctor).rejects.toMatchObject({
				code: "DOCTOR_TARGETS_INVALID",
				message: expect.stringContaining(targetName),
			});
		},
	);

	test("accepts empty target lists without a store", async () => {
		const http = createTestHttp(SIGNED_IN_HANDLERS);

		const report = await doctor(http, "test", {
			allResources: false,
			productIds: [],
			discountIds: [],
		});

		expect(listCheckNames(report)).toEqual(["connection"]);
	});

	test("runs each explicit id once", async () => {
		const http = createTestHttp([
			...STORE_SCOPED_HANDLERS,
			replyAtPath("/v1/discounts/600", PUBLISHED_DISCOUNT_DOCUMENT),
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
		const http = createTestHttp(DISCOVERY_HANDLERS);

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
		const http = createTestHttp(DISCOVERY_HANDLERS);

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
		const http = createTestHttp([
			replyToVariantList("100", {
				data: [NON_SUBSCRIPTION_VARIANT_DOCUMENT.data],
			}),
			...DISCOVERY_HANDLERS,
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
			const http = createTestHttp([
				replyToStoreList(collection, NOT_FOUND_ERROR, 500),
				...DISCOVERY_HANDLERS,
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
		const http = createTestHttp([
			replyToVariantList("100", NOT_FOUND_ERROR, 500),
			...DISCOVERY_HANDLERS,
		]);

		const report = await doctor(http, "test", {
			storeId: "42",
			allResources: true,
		});

		const listingFailure = report.checks.find(
			(check) => check.target?.label === "plans of product 100 of store 42",
		);
		expect(report.ok).toBe(false);
		expect(listingFailure?.name).toBe("subscriptionPlan");
		expect(listCheckNames(report)).toContain("discount");
	});
});

describe("listStoreIds", () => {
	test("lists every store id", async () => {
		const http = createTestHttp(SIGNED_IN_HANDLERS);

		const storeIds = await listStoreIds(http);

		expect(storeIds).toEqual(["42"]);
	});

	test("throws NO_STORES when the key reaches no store", async () => {
		const http = createTestHttp([replyAtPath("/v1/stores", { data: [] })]);

		const failedListing = listStoreIds(http);

		await expect(failedListing).rejects.toMatchObject({ code: "NO_STORES" });
	});

	test("throws AUTH_FAILED when the key is rejected", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/stores", UNAUTHORIZED_ERROR, 401),
		]);

		const failedListing = listStoreIds(http);

		await expect(failedListing).rejects.toMatchObject({
			code: "AUTH_FAILED",
			message: "API key rejected by Lemon Squeezy.",
		});
	});
});
