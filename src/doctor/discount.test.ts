import { makeHttp, route } from "@e2e/mock-fetch.js";
import {
	draftDiscountDoc,
	exhaustedDiscountDoc,
	expiredDiscountDoc,
	futureDiscountDoc,
	invalidPercentDiscountDoc,
	NOT_FOUND_ERROR,
	publishedDiscountDoc,
	UNAUTHORIZED_ERROR,
	wrongStoreDiscountDoc,
	zeroAmountDiscountDoc,
} from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { validateDiscount } from "./discount.js";

const DISCOUNT_ID = "600";
const PAST_DATE = "2020-01-01T00:00:00Z";
const FUTURE_DATE = "2099-12-31T23:59:59Z";

type DiscountReply = typeof publishedDiscountDoc;

const createDiscountReply = (
	overrides: Partial<DiscountReply["data"]["attributes"]>,
): DiscountReply => ({
	data: {
		...publishedDiscountDoc.data,
		attributes: { ...publishedDiscountDoc.data.attributes, ...overrides },
	},
});

const checkDiscountReply = (reply: unknown, status = 200) => {
	const http = makeHttp([route(`/v1/discounts/${DISCOUNT_ID}`, reply, status)]);
	return validateDiscount(http, "test", {
		storeId: "42",
		discountId: DISCOUNT_ID,
	});
};

const listCodes = (findings: { code: string }[]) =>
	findings.map((finding) => finding.code);

describe("validateDiscount", () => {
	test("passes a valid published discount and describes its target", async () => {
		const reply = publishedDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toHaveLength(0);
		expect(report.resource?.code).toBe("SUMMER20");
		expect(report.target).toEqual({
			label: "Summer Sale (SUMMER20)",
			id: DISCOUNT_ID,
		});
	});

	test("reports DISCOUNT_NOT_FOUND when the discount does not exist", async () => {
		const reply = NOT_FOUND_ERROR;

		const report = await checkDiscountReply(reply, 404);

		expect(report.ok).toBe(false);
		expect(listCodes(report.findings)).toEqual(["DISCOUNT_NOT_FOUND"]);
		expect(report.target).toEqual({
			label: `discount ${DISCOUNT_ID}`,
			id: DISCOUNT_ID,
		});
	});

	test("reports AUTH_FAILED when the key is rejected", async () => {
		const reply = UNAUTHORIZED_ERROR;

		const report = await checkDiscountReply(reply, 401);

		expect(report.ok).toBe(false);
		expect(listCodes(report.findings)).toEqual(["AUTH_FAILED"]);
	});

	test("warns about a draft discount", async () => {
		const reply = draftDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_DRAFT", severity: "warning" },
		]);
	});

	test("flags an expired discount as an error", async () => {
		const reply = expiredDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_EXPIRED", severity: "error" },
		]);
	});

	test("accepts a discount that expires in the future or never", async () => {
		const neverExpiresReply = createDiscountReply({ expires_at: null });
		const futureExpiryReply = createDiscountReply({ expires_at: FUTURE_DATE });

		const neverExpiresReport = await checkDiscountReply(neverExpiresReply);
		const futureExpiryReport = await checkDiscountReply(futureExpiryReply);

		expect(neverExpiresReport.findings).toHaveLength(0);
		expect(futureExpiryReport.findings).toHaveLength(0);
	});

	test("warns about a discount that has not started yet", async () => {
		const reply = futureDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_NOT_STARTED", severity: "warning" },
		]);
	});

	test("accepts a discount that already started", async () => {
		const reply = createDiscountReply({ starts_at: PAST_DATE });

		const report = await checkDiscountReply(reply);

		expect(report.findings).toHaveLength(0);
	});

	test("warns when limited redemptions are used up", async () => {
		const reply = exhaustedDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_REDEMPTIONS_EXHAUSTED", severity: "warning" },
		]);
	});

	test("accepts limited redemptions that are still available", async () => {
		const reply = createDiscountReply({
			is_limited_redemptions: true,
			max_redemptions: 10,
		});

		const report = await checkDiscountReply(reply);

		expect(report.findings).toHaveLength(0);
	});

	test("flags a percent discount over 100 as an error", async () => {
		const reply = invalidPercentDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_INVALID_AMOUNT", severity: "error" },
		]);
	});

	test("accepts a 100 percent discount and a large fixed discount", async () => {
		const fullPercentReply = createDiscountReply({ amount: 100 });
		const largeFixedReply = createDiscountReply({
			amount: 500,
			amount_type: "fixed",
		});

		const fullPercentReport = await checkDiscountReply(fullPercentReply);
		const largeFixedReport = await checkDiscountReply(largeFixedReply);

		expect(fullPercentReport.findings).toHaveLength(0);
		expect(largeFixedReport.findings).toHaveLength(0);
	});

	test("flags an amount of zero or less as an error", async () => {
		const reply = zeroAmountDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_INVALID_AMOUNT", severity: "error" },
		]);
	});

	test("flags a discount from another store as an error", async () => {
		const reply = wrongStoreDiscountDoc;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_STORE_MISMATCH", severity: "error" },
		]);
	});
});
