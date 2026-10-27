import {
	draftDiscountDoc,
	exhaustedDiscountDoc,
	expiredDiscountDoc,
	futureDiscountDoc,
	invalidPercentDiscountDoc,
	NOT_FOUND_ERROR,
	publishedDiscountDoc,
	wrongStoreDiscountDoc,
	zeroAmountDiscountDoc,
} from "@e2e/fixtures/sandbox/data.js";
import { makeHttp, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateDiscount } from "./discount.js";

test("validateDiscount returns ok for a valid published discount", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/discounts/600"),
			status: 200,
			body: publishedDiscountDoc,
		},
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "600",
	});
	expect(discountValidation.ok).toBe(true);
	expect(discountValidation.resource?.code).toBe("SUMMER20");
	expect(discountValidation.findings).toHaveLength(0);
});

test("validateDiscount returns DISCOUNT_NOT_FOUND on 404", async () => {
	const http = makeHttp([
		{ match: pathIs("/v1/discounts/9999"), status: 404, body: NOT_FOUND_ERROR },
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "9999",
	});
	expect(discountValidation.ok).toBe(false);
	expect(discountValidation.findings[0]?.code).toBe("DISCOUNT_NOT_FOUND");
});

test("validateDiscount returns DISCOUNT_DRAFT for draft status", async () => {
	const http = makeHttp([
		{ match: pathIs("/v1/discounts/601"), status: 200, body: draftDiscountDoc },
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "601",
	});
	expect(discountValidation.ok).toBe(true);
	expect(discountValidation.findings[0]?.code).toBe("DISCOUNT_DRAFT");
	expect(discountValidation.findings[0]?.severity).toBe("warning");
});

test("validateDiscount returns DISCOUNT_EXPIRED for past expires_at", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/discounts/602"),
			status: 200,
			body: expiredDiscountDoc,
		},
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "602",
	});
	expect(discountValidation.ok).toBe(false);
	expect(discountValidation.findings[0]?.code).toBe("DISCOUNT_EXPIRED");
});

test("validateDiscount returns DISCOUNT_NOT_STARTED for future starts_at", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/discounts/603"),
			status: 200,
			body: futureDiscountDoc,
		},
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "603",
	});
	expect(discountValidation.ok).toBe(true);
	expect(discountValidation.findings[0]?.code).toBe("DISCOUNT_NOT_STARTED");
	expect(discountValidation.findings[0]?.severity).toBe("warning");
});

test("validateDiscount returns DISCOUNT_REDEMPTIONS_EXHAUSTED when limited and max ≤ 0", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/discounts/604"),
			status: 200,
			body: exhaustedDiscountDoc,
		},
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "604",
	});
	expect(discountValidation.ok).toBe(true);
	expect(discountValidation.findings[0]?.code).toBe(
		"DISCOUNT_REDEMPTIONS_EXHAUSTED",
	);
	expect(discountValidation.findings[0]?.severity).toBe("warning");
});

test("validateDiscount returns DISCOUNT_INVALID_AMOUNT for percent > 100", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/discounts/605"),
			status: 200,
			body: invalidPercentDiscountDoc,
		},
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "605",
	});
	expect(discountValidation.ok).toBe(false);
	expect(discountValidation.findings[0]?.code).toBe("DISCOUNT_INVALID_AMOUNT");
});

test("validateDiscount returns DISCOUNT_INVALID_AMOUNT for amount ≤ 0", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/discounts/606"),
			status: 200,
			body: zeroAmountDiscountDoc,
		},
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "606",
	});
	expect(discountValidation.ok).toBe(false);
	expect(discountValidation.findings[0]?.code).toBe("DISCOUNT_INVALID_AMOUNT");
});

test("validateDiscount returns DISCOUNT_STORE_MISMATCH for wrong store", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/discounts/607"),
			status: 200,
			body: wrongStoreDiscountDoc,
		},
	]);
	const discountValidation = await validateDiscount(http, "test", {
		storeId: "42",
		discountId: "607",
	});
	expect(discountValidation.ok).toBe(false);
	expect(discountValidation.findings[0]?.code).toBe("DISCOUNT_STORE_MISMATCH");
});
