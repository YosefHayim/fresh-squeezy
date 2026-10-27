import { makeHttp, route } from "@e2e/mock-fetch.js";
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
	UNAUTHORIZED_ERROR,
	wrongStoreSubscriptionVariantDoc,
} from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { validateSubscriptionPlan } from "./subscription-plan.js";

const VARIANT_ID = "800";
const PRODUCT_ROUTE = route("/v1/products/100", PUBLISHED_PRODUCT_DOC);

const createVariantReply = (overrides: Record<string, unknown>) => ({
	data: {
		...subscriptionVariantDoc.data,
		attributes: { ...subscriptionVariantDoc.data.attributes, ...overrides },
	},
});

const checkVariantReply = (reply: unknown, productRoutes = [PRODUCT_ROUTE]) => {
	const http = makeHttp([
		route(`/v1/variants/${VARIANT_ID}`, reply),
		...productRoutes,
	]);
	return validateSubscriptionPlan(http, "test", {
		storeId: "42",
		variantId: VARIANT_ID,
	});
};

const listCodes = (findings: { code: string }[]) =>
	findings.map((finding) => finding.code);

describe("validateSubscriptionPlan", () => {
	test("passes a valid subscription variant and describes its plan", async () => {
		const reply = subscriptionVariantDoc;

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toHaveLength(0);
		expect(report.resource).toEqual({
			variantId: VARIANT_ID,
			interval: "month",
			intervalCount: 1,
			price: 1900,
			hasFreeTrial: false,
			status: "published",
		});
		expect(report.target).toEqual({ label: "Pro Monthly", id: VARIANT_ID });
	});

	test("reports PLAN_VARIANT_NOT_FOUND when the variant does not exist", async () => {
		const http = makeHttp([
			route(`/v1/variants/${VARIANT_ID}`, NOT_FOUND_ERROR, 404),
		]);

		const report = await validateSubscriptionPlan(http, "test", {
			storeId: "42",
			variantId: VARIANT_ID,
		});

		expect(report.ok).toBe(false);
		expect(listCodes(report.findings)).toEqual(["PLAN_VARIANT_NOT_FOUND"]);
		expect(report.target).toEqual({
			label: `variant ${VARIANT_ID}`,
			id: VARIANT_ID,
		});
	});

	test("reports AUTH_FAILED when the key is rejected", async () => {
		const http = makeHttp([
			route(`/v1/variants/${VARIANT_ID}`, UNAUTHORIZED_ERROR, 401),
		]);

		const report = await validateSubscriptionPlan(http, "test", {
			storeId: "42",
			variantId: VARIANT_ID,
		});

		expect(listCodes(report.findings)).toEqual(["AUTH_FAILED"]);
	});

	test("flags a variant that is not a subscription as an error", async () => {
		const reply = nonSubscriptionVariantDoc;

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings[0]).toMatchObject({
			code: "PLAN_NOT_SUBSCRIPTION",
			severity: "error",
		});
	});

	test("flags a missing interval and a zero interval count as errors", async () => {
		const reply = invalidIntervalVariantDoc;

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(false);
		expect(listCodes(report.findings)).toEqual([
			"PLAN_INVALID_INTERVAL",
			"PLAN_INVALID_INTERVAL",
		]);
		expect(report.findings[0]?.message).toContain('"missing"');
		expect(report.findings[1]?.message).toContain("interval_count: 0");
	});

	test("flags an interval that is not day, week, month or year", async () => {
		const reply = createVariantReply({ interval: "fortnight" });

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{
				code: "PLAN_INVALID_INTERVAL",
				message: expect.stringContaining("fortnight"),
			},
		]);
	});

	test("flags a subscription variant with no interval_count", async () => {
		const reply = missingIntervalCountVariantDoc;

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings[0]?.message).toContain("interval_count: missing");
	});

	test("flags a negative interval count and accepts a positive one", async () => {
		const negativeReply = createVariantReply({ interval_count: -1 });
		const biweeklyReply = createVariantReply({
			interval: "week",
			interval_count: 2,
		});

		const negativeReport = await checkVariantReply(negativeReply);
		const biweeklyReport = await checkVariantReply(biweeklyReply);

		expect(listCodes(negativeReport.findings)).toEqual([
			"PLAN_INVALID_INTERVAL",
		]);
		expect(biweeklyReport.findings).toHaveLength(0);
	});

	test("warns about a free subscription price", async () => {
		const reply = freePriceSubscriptionVariantDoc;

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "PLAN_FREE_PRICE", severity: "warning" },
		]);
	});

	test("does not warn about a free price on a variant that is not a subscription", async () => {
		const reply = createVariantReply({ is_subscription: false, price: 0 });

		const report = await checkVariantReply(reply);

		expect(listCodes(report.findings)).toEqual(["PLAN_NOT_SUBSCRIPTION"]);
	});

	test("warns about a free trial with a zero trial count", async () => {
		const reply = trialInconsistentVariantDoc;

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "PLAN_TRIAL_INCONSISTENT", severity: "warning" },
		]);
	});

	test("warns about a free trial with no trial interval and no trial count", async () => {
		const reply = createVariantReply({
			has_free_trial: true,
			trial_interval: null,
			trial_interval_count: null,
		});

		const report = await checkVariantReply(reply);

		expect(report.findings).toMatchObject([
			{
				code: "PLAN_TRIAL_INCONSISTENT",
				message: expect.stringContaining('interval: "missing", count: 0'),
			},
		]);
	});

	test("warns about a free trial with a count but no trial interval", async () => {
		const reply = createVariantReply({
			has_free_trial: true,
			trial_interval: null,
			trial_interval_count: 7,
		});

		const report = await checkVariantReply(reply);

		expect(listCodes(report.findings)).toEqual(["PLAN_TRIAL_INCONSISTENT"]);
	});

	test("warns about a free trial with a trial interval but no trial count", async () => {
		const reply = createVariantReply({
			has_free_trial: true,
			trial_interval: "day",
			trial_interval_count: 0,
		});

		const report = await checkVariantReply(reply);

		expect(report.findings).toMatchObject([
			{
				code: "PLAN_TRIAL_INCONSISTENT",
				message: expect.stringContaining('interval: "day", count: 0'),
			},
		]);
	});

	test("accepts a complete free trial", async () => {
		const completeTrialReply = createVariantReply({
			has_free_trial: true,
			trial_interval: "day",
			trial_interval_count: 14,
		});

		const completeTrialReport = await checkVariantReply(completeTrialReply);

		expect(completeTrialReport.findings).toHaveLength(0);
	});

	test("warns about a draft subscription variant", async () => {
		const reply = draftSubscriptionVariantDoc;

		const report = await checkVariantReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "PLAN_DRAFT", severity: "warning" },
		]);
	});

	test("flags a variant whose product belongs to another store", async () => {
		const reply = wrongStoreSubscriptionVariantDoc;
		const productRoute = route("/v1/products/102", PRODUCT_ON_WRONG_STORE_DOC);

		const report = await checkVariantReply(reply, [productRoute]);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{
				code: "PLAN_STORE_MISMATCH",
				severity: "error",
				context: { productId: "102", actualStoreId: "99" },
			},
		]);
	});

	test("skips the store check when the product cannot be loaded", async () => {
		const reply = createVariantReply({ status: "draft" });

		const report = await checkVariantReply(reply, []);

		expect(listCodes(report.findings)).toEqual(["PLAN_DRAFT"]);
	});
});
