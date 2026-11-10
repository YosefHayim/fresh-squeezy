import { describe, expect, test } from "vitest";
import {
	DRAFT_DISCOUNT_DOCUMENT,
	EXHAUSTED_DISCOUNT_DOCUMENT,
	EXPIRED_DISCOUNT_DOCUMENT,
	FUTURE_DISCOUNT_DOCUMENT,
	INVALID_PERCENT_DISCOUNT_DOCUMENT,
	NOT_FOUND_ERROR,
	PUBLISHED_DISCOUNT_DOCUMENT,
	UNAUTHORIZED_ERROR,
	WRONG_STORE_DISCOUNT_DOCUMENT,
	ZERO_AMOUNT_DISCOUNT_DOCUMENT,
} from "@/lemon-squeezy-fixtures.js";
import { createTestHttp, replyAtPath } from "@/mock-lemon-squeezy-api.js";
import { validateDiscount } from "./discount.js";

const DISCOUNT_ID = "600";
const PAST_DATE = "2020-01-01T00:00:00Z";
const FUTURE_DATE = "2099-12-31T23:59:59Z";

type DiscountReply = typeof PUBLISHED_DISCOUNT_DOCUMENT;

const createDiscountReply = (
	overrides: Partial<DiscountReply["data"]["attributes"]>,
): DiscountReply => ({
	data: {
		...PUBLISHED_DISCOUNT_DOCUMENT.data,
		attributes: {
			...PUBLISHED_DISCOUNT_DOCUMENT.data.attributes,
			...overrides,
		},
	},
});

const checkDiscountReply = (reply: unknown, status = 200) => {
	const http = createTestHttp([
		replyAtPath(`/v1/discounts/${DISCOUNT_ID}`, reply, status),
	]);
	return validateDiscount(http, "test", {
		storeId: "42",
		discountId: DISCOUNT_ID,
	});
};

const listCodes = (findings: { code: string }[]) =>
	findings.map((finding) => finding.code);

describe("validateDiscount", () => {
	test("passes a valid published discount and describes its target", async () => {
		const reply = PUBLISHED_DISCOUNT_DOCUMENT;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toHaveLength(0);
		expect(report.resource?.code).toBe("SUMMER20");
		expect(report.target).toEqual({
			label: "Summer Sale (SUMMER20)",
			id: DISCOUNT_ID,
			url: null,
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
			url: null,
		});
	});

	test("reports AUTH_FAILED when the key is rejected", async () => {
		const reply = UNAUTHORIZED_ERROR;

		const report = await checkDiscountReply(reply, 401);

		expect(report.ok).toBe(false);
		expect(listCodes(report.findings)).toEqual(["AUTH_FAILED"]);
	});

	test("warns about a draft discount", async () => {
		const reply = DRAFT_DISCOUNT_DOCUMENT;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(true);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_DRAFT", severity: "warning" },
		]);
	});

	test("flags an expired discount as an error", async () => {
		const reply = EXPIRED_DISCOUNT_DOCUMENT;

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
		const reply = FUTURE_DISCOUNT_DOCUMENT;

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
		const reply = EXHAUSTED_DISCOUNT_DOCUMENT;

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
		const reply = INVALID_PERCENT_DISCOUNT_DOCUMENT;

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
		const reply = ZERO_AMOUNT_DISCOUNT_DOCUMENT;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_INVALID_AMOUNT", severity: "error" },
		]);
	});

	test("flags a discount from another store as an error", async () => {
		const reply = WRONG_STORE_DISCOUNT_DOCUMENT;

		const report = await checkDiscountReply(reply);

		expect(report.ok).toBe(false);
		expect(report.findings).toMatchObject([
			{ code: "DISCOUNT_STORE_MISMATCH", severity: "error" },
		]);
	});
});
