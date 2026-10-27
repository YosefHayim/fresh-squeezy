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
} from "@e2e/fixtures/sandbox/data.js";
import { createMockFetch, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { HttpClient } from "@/http/http.js";
import { resolveConfig } from "@/shared/config.js";
import { validateSubscriptionPlan } from "./subscription-plan.js";

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
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 800,
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.resource?.interval).toBe("month");
	expect(planValidation.issues).toHaveLength(0);
});

test("validateSubscriptionPlan returns PLAN_VARIANT_NOT_FOUND on 404", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/variants/9999"), status: 404, body: notFoundError },
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 9999,
	});
	expect(planValidation.ok).toBe(false);
	expect(planValidation.issues[0]?.code).toBe("PLAN_VARIANT_NOT_FOUND");
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
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 801,
	});
	expect(planValidation.ok).toBe(false);
	expect(planValidation.issues[0]?.code).toBe("PLAN_NOT_SUBSCRIPTION");
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
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 802,
	});
	expect(planValidation.ok).toBe(false);
	const intervalIssues = planValidation.issues.filter(
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
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 803,
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.issues[0]?.code).toBe("PLAN_FREE_PRICE");
	expect(planValidation.issues[0]?.severity).toBe("warning");
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
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 804,
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.issues[0]?.code).toBe("PLAN_TRIAL_INCONSISTENT");
	expect(planValidation.issues[0]?.severity).toBe("warning");
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
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 805,
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.issues[0]?.code).toBe("PLAN_DRAFT");
	expect(planValidation.issues[0]?.severity).toBe("warning");
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
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: 42,
		variantId: 806,
	});
	expect(planValidation.ok).toBe(false);
	expect(planValidation.issues[0]?.code).toBe("PLAN_STORE_MISMATCH");
});
