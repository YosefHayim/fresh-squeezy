import {
	activeLicenseKeyDoc,
	publishedDiscountDoc,
	publishedProductDoc,
	storeDoc,
	subscriptionVariantDoc,
	unauthorizedError,
} from "@e2e/fixtures/sandbox/data.js";
import { makeClient, route, SIGNED_IN_ROUTES } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { doctor } from "./doctor.js";

test("doctor skips validators for targets that are not configured", async () => {
	const http = makeClient(SIGNED_IN_ROUTES);

	const report = await doctor(http, "test");

	expect(report.results).toHaveLength(1);
	expect(report.results[0]?.name).toBe("connection");
});

const storeScopedRoutes = [
	...SIGNED_IN_ROUTES,
	route("/v1/stores/42", storeDoc),
];

const targetCases = [
	{
		title: "discount validator when discountId is provided",
		routes: [route("/v1/discounts/600", publishedDiscountDoc)],
		options: { discountIds: [600] },
		name: "discount",
	},
	{
		title: "license key validator when licenseKeyId is provided",
		routes: [route("/v1/license-keys/700", activeLicenseKeyDoc)],
		options: { licenseKeyIds: [700] },
		name: "licenseKey",
	},
	{
		title: "subscription plan validator when variantId is provided",
		routes: [
			route("/v1/variants/800", subscriptionVariantDoc),
			route("/v1/products/100", publishedProductDoc),
		],
		options: { variantIds: [800] },
		name: "subscriptionPlan",
	},
];

test.each(targetCases)(
	"doctor runs $title",
	async ({ routes, options, name }) => {
		const http = makeClient([...storeScopedRoutes, ...routes]);

		const report = await doctor(http, "test", { storeId: 42, ...options });

		expect(report.ok).toBe(true);
		expect(report.results.some((entry) => entry.name === name)).toBe(true);
	},
);

test("doctor includes discount failure in overall ok", async () => {
	const http = makeClient([
		...storeScopedRoutes,
		route("/v1/discounts/9999", unauthorizedError, 404),
	]);

	const report = await doctor(http, "test", {
		storeId: 42,
		discountIds: [9999],
	});

	expect(report.ok).toBe(false);
	expect(report.results.some((r) => r.name === "discount" && !r.ok)).toBe(true);
});
