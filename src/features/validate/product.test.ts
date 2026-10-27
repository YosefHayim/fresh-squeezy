import {
	NOT_FOUND_ERROR,
	PRODUCT_ON_WRONG_STORE_DOC,
	PUBLISHED_PRODUCT_DOC,
	UNPUBLISHED_PRODUCT_DOC,
	VARIANTS_COLLECTION_ALL_DRAFT,
	VARIANTS_COLLECTION_EMPTY,
	VARIANTS_COLLECTION_PUBLISHED,
} from "@e2e/fixtures/sandbox/data.js";
import { makeHttp, pathIs, pathIsWithQuery, route } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateProduct } from "./product.js";

const publishedProductRoutes = (
	variantsStatus: number,
	variantsBody: unknown,
) => [
	route("/v1/products/100", PUBLISHED_PRODUCT_DOC),
	{
		match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
		status: variantsStatus,
		body: variantsBody,
	},
];

test("validateProduct passes a published product with a published variant", async () => {
	const http = makeHttp(
		publishedProductRoutes(200, VARIANTS_COLLECTION_PUBLISHED),
	);

	const productValidation = await validateProduct(http, "test", {
		productId: "100",
		expectedStoreId: "42",
	});

	expect(productValidation.ok).toBe(true);
	expect(productValidation.findings).toHaveLength(0);
});

test("validateProduct flags unpublished product and draft-only variants", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/products/101"),
			status: 200,
			body: UNPUBLISHED_PRODUCT_DOC,
		},
		{
			match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "101" }),
			status: 200,
			body: VARIANTS_COLLECTION_ALL_DRAFT,
		},
	]);

	const productValidation = await validateProduct(http, "test", {
		productId: "101",
	});

	expect(productValidation.ok).toBe(false);
	const codes = productValidation.findings.map((entry) => entry.code);
	expect(codes).toContain("PRODUCT_UNPUBLISHED");
	expect(codes).toContain("VARIANT_UNPUBLISHED");
	expect(codes).toContain("PRODUCT_NO_BUY_URL");
});

test("validateProduct flags product on wrong store when expectedStoreId mismatches", async () => {
	const http = makeHttp([
		{
			match: pathIs("/v1/products/102"),
			status: 200,
			body: PRODUCT_ON_WRONG_STORE_DOC,
		},
		{
			match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "102" }),
			status: 200,
			body: VARIANTS_COLLECTION_PUBLISHED,
		},
	]);

	const productValidation = await validateProduct(http, "test", {
		productId: "102",
		expectedStoreId: "42",
	});

	expect(productValidation.ok).toBe(false);
	expect(productValidation.findings.map((entry) => entry.code)).toContain(
		"PRODUCT_WRONG_STORE",
	);
});

test("validateProduct returns PRODUCT_NOT_FOUND on 404", async () => {
	const http = makeHttp([
		{ match: pathIs("/v1/products/9999"), status: 404, body: NOT_FOUND_ERROR },
	]);
	const productValidation = await validateProduct(http, "test", {
		productId: "9999",
	});
	expect(productValidation.ok).toBe(false);
	expect(productValidation.findings[0]?.code).toBe("PRODUCT_NOT_FOUND");
});

test("validateProduct flags VARIANT_MISSING when no variants exist", async () => {
	const http = makeHttp(publishedProductRoutes(200, VARIANTS_COLLECTION_EMPTY));

	const productValidation = await validateProduct(http, "test", {
		productId: "100",
	});

	expect(productValidation.ok).toBe(false);
	expect(productValidation.findings.map((entry) => entry.code)).toContain(
		"VARIANT_MISSING",
	);
});

test("validateProduct soft-fails variant listing as a warning without failing the product check", async () => {
	const http = makeHttp(
		publishedProductRoutes(500, { errors: [{ detail: "upstream" }] }),
	);

	const productValidation = await validateProduct(http, "test", {
		productId: "100",
	});

	expect(productValidation.ok).toBe(true);
	const variantIssue = productValidation.findings.find(
		(entry) => entry.code === "UNKNOWN",
	);
	expect(variantIssue?.severity).toBe("warning");
});
