import { makeHttp, pathIs, route } from "@e2e/mock-fetch.js";
import {
	draftSubscriptionVariantDoc,
	freePriceSubscriptionVariantDoc,
	invalidIntervalVariantDoc,
	missingIntervalCountVariantDoc,
	NOT_FOUND_ERROR,
	nonSubscriptionVariantDoc,
	PRODUCT_ON_WRONG_STORE_DOC,
	PUBLISHED_PRODUCT_DOC,
	subscriptionVariantDoc,
	trialInconsistentVariantDoc,
	wrongStoreSubscriptionVariantDoc,
} from "@e2e/sandbox-store.js";
import { expect, test } from "vitest";
import { validateSubscriptionPlan } from "./subscription-plan.js";

test("validateSubscriptionPlan returns ok for a valid subscription variant", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/800"),
			status: 200,
			replyDocument: subscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			replyDocument: PUBLISHED_PRODUCT_DOC,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "800",
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.resource?.interval).toBe("month");
	expect(planValidation.findings).toHaveLength(0);
});

test("validateSubscriptionPlan returns PLAN_VARIANT_NOT_FOUND on 404", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/9999"),
			status: 404,
			replyDocument: NOT_FOUND_ERROR,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "9999",
	});
	expect(planValidation.ok).toBe(false);
	expect(planValidation.findings[0]?.code).toBe("PLAN_VARIANT_NOT_FOUND");
});

test("validateSubscriptionPlan returns PLAN_NOT_SUBSCRIPTION for non-subscription variant", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/801"),
			status: 200,
			replyDocument: nonSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			replyDocument: PUBLISHED_PRODUCT_DOC,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "801",
	});
	expect(planValidation.ok).toBe(false);
	expect(planValidation.findings[0]?.code).toBe("PLAN_NOT_SUBSCRIPTION");
});

test("validateSubscriptionPlan returns PLAN_INVALID_INTERVAL for missing/invalid interval and count", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/802"),
			status: 200,
			replyDocument: invalidIntervalVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			replyDocument: PUBLISHED_PRODUCT_DOC,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "802",
	});
	expect(planValidation.ok).toBe(false);
	const intervalFindings = planValidation.findings.filter(
		(i) => i.code === "PLAN_INVALID_INTERVAL",
	);
	expect(intervalFindings.length).toBe(2);
});

test("validateSubscriptionPlan returns PLAN_FREE_PRICE for zero-price subscription", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/803"),
			status: 200,
			replyDocument: freePriceSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			replyDocument: PUBLISHED_PRODUCT_DOC,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "803",
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.findings[0]?.code).toBe("PLAN_FREE_PRICE");
	expect(planValidation.findings[0]?.severity).toBe("warning");
});

test("validateSubscriptionPlan returns PLAN_TRIAL_INCONSISTENT for misconfigured trial", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/804"),
			status: 200,
			replyDocument: trialInconsistentVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			replyDocument: PUBLISHED_PRODUCT_DOC,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "804",
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.findings[0]?.code).toBe("PLAN_TRIAL_INCONSISTENT");
	expect(planValidation.findings[0]?.severity).toBe("warning");
});

test("validateSubscriptionPlan returns PLAN_DRAFT for draft subscription variant", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/805"),
			status: 200,
			replyDocument: draftSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/100"),
			status: 200,
			replyDocument: PUBLISHED_PRODUCT_DOC,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "805",
	});
	expect(planValidation.ok).toBe(true);
	expect(planValidation.findings[0]?.code).toBe("PLAN_DRAFT");
	expect(planValidation.findings[0]?.severity).toBe("warning");
});

test("validateSubscriptionPlan returns PLAN_STORE_MISMATCH when variant belongs to different store", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/variants/806"),
			status: 200,
			replyDocument: wrongStoreSubscriptionVariantDoc,
		},
		{
			match: pathIs("/v1/products/102"),
			status: 200,
			replyDocument: PRODUCT_ON_WRONG_STORE_DOC,
		},
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "806",
	});
	expect(planValidation.ok).toBe(false);
	expect(planValidation.findings[0]?.code).toBe("PLAN_STORE_MISMATCH");
});

test("validateSubscriptionPlan flags a subscription variant with no interval_count", async () => {
	const http = makeHttp([
		route("/v1/variants/810", missingIntervalCountVariantDoc),
		route("/v1/products/100", PUBLISHED_PRODUCT_DOC),
	]);
	const planValidation = await validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: "810",
	});
	expect(planValidation.ok).toBe(false);
	const intervalFinding = planValidation.findings.find(
		(finding) => finding.code === "PLAN_INVALID_INTERVAL",
	);
	expect(intervalFinding?.message).toContain("interval_count: missing");
});
