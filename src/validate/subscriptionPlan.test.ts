import { expect, test } from "vitest";
import {
	draftSubscriptionVariantDoc,
	freePriceSubscriptionVariantDoc,
	invalidIntervalVariantDoc,
	nonSubscriptionVariantDoc,
	notFoundError,
	productOnWrongStoreDoc,
	publishedProductDoc,
	subscriptionVariantDoc,
	trialInconsistentVariantDoc,
	wrongStoreSubscriptionVariantDoc,
} from "../../tests/fixtures/sandbox/data.js";
import { createMockFetch, pathIs } from "../../tests/helpers/mockFetch.js";
import { resolveConfig } from "../core/config.js";
import { HttpClient } from "../core/http.js";
import { validateSubscriptionPlan } from "./subscriptionPlan.js";

const makeClient = (routes: Parameters<typeof createMockFetch>[0]) => {
	const { fetch } = createMockFetch(routes);
	return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
};

test("validateSubscriptionPlan returns ok for a valid subscription variant", async () => {
	const http = makeClient([
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
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 800,
	});
	expect(result.ok).toBe(true);
	expect(result.resource?.interval).toBe("month");
	expect(result.issues).toHaveLength(0);
});

test("validateSubscriptionPlan returns PLAN_VARIANT_NOT_FOUND on 404", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/variants/9999"), status: 404, body: notFoundError },
	]);
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 9999,
	});
	expect(result.ok).toBe(false);
	expect(result.issues[0]?.code).toBe("PLAN_VARIANT_NOT_FOUND");
});

test("validateSubscriptionPlan returns PLAN_NOT_SUBSCRIPTION for non-subscription variant", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/variants/801"),
			status: 200,
			body: nonSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
	]);
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 801,
	});
	expect(result.ok).toBe(false);
	expect(result.issues[0]?.code).toBe("PLAN_NOT_SUBSCRIPTION");
});

test("validateSubscriptionPlan returns PLAN_INVALID_INTERVAL for missing/invalid interval and count", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/variants/802"),
			status: 200,
			body: invalidIntervalVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
	]);
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 802,
	});
	expect(result.ok).toBe(false);
	const intervalIssues = result.issues.filter(
		(i) => i.code === "PLAN_INVALID_INTERVAL",
	);
	expect(intervalIssues.length).toBe(2);
});

test("validateSubscriptionPlan returns PLAN_FREE_PRICE for zero-price subscription", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/variants/803"),
			status: 200,
			body: freePriceSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
	]);
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 803,
	});
	expect(result.ok).toBe(true);
	expect(result.issues[0]?.code).toBe("PLAN_FREE_PRICE");
	expect(result.issues[0]?.severity).toBe("warning");
});

test("validateSubscriptionPlan returns PLAN_TRIAL_INCONSISTENT for misconfigured trial", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/variants/804"),
			status: 200,
			body: trialInconsistentVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
	]);
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 804,
	});
	expect(result.ok).toBe(true);
	expect(result.issues[0]?.code).toBe("PLAN_TRIAL_INCONSISTENT");
	expect(result.issues[0]?.severity).toBe("warning");
});

test("validateSubscriptionPlan returns PLAN_DRAFT for draft subscription variant", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/variants/805"),
			status: 200,
			body: draftSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			body: publishedProductDoc,
		},
	]);
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 805,
	});
	expect(result.ok).toBe(true);
	expect(result.issues[0]?.code).toBe("PLAN_DRAFT");
	expect(result.issues[0]?.severity).toBe("warning");
});

test("validateSubscriptionPlan returns PLAN_STORE_MISMATCH when variant belongs to different store", async () => {
	const http = makeClient([
		{
			match: pathIs("/v1/variants/806"),
			status: 200,
			body: wrongStoreSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/102"),
			status: 200,
			body: productOnWrongStoreDoc,
		},
	]);
	const result = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 806,
	});
	expect(result.ok).toBe(false);
	expect(result.issues[0]?.code).toBe("PLAN_STORE_MISMATCH");
});
