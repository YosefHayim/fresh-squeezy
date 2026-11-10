import {
	createTestHttp,
	replyAtPath,
	replyToVariantList,
} from "@/mock-lemon-squeezy-api.js";
import {
	NOT_FOUND_ERROR,
	PRODUCT_ON_WRONG_STORE_DOCUMENT,
	PUBLISHED_PRODUCT_DOCUMENT,
	UNAUTHORIZED_ERROR,
	UNPUBLISHED_PRODUCT_DOCUMENT,
	VARIANTS_COLLECTION_ALL_DRAFT,
	VARIANTS_COLLECTION_DEFAULT_ONLY,
	VARIANTS_COLLECTION_EMPTY,
	VARIANTS_COLLECTION_PENDING_AND_DRAFT,
	VARIANTS_COLLECTION_PUBLISHED,
} from "@/lemon-squeezy-fixtures.js";
import { describe, expect, test } from "vitest";
import { validateProduct } from "./product.js";

const createPublishedProductHandlers = (
	variantsStatus: number,
	variantsReplyDocument: unknown,
) => {
	const variantsHandler = replyToVariantList(
		"100",
		variantsReplyDocument,
		variantsStatus,
	);
	return [
		replyAtPath("/v1/products/100", PUBLISHED_PRODUCT_DOCUMENT),
		variantsHandler,
	];
};

const validatePublishedProduct = (
	variantsStatus: number,
	variantsReplyDocument: unknown,
) => {
	const handlers = createPublishedProductHandlers(
		variantsStatus,
		variantsReplyDocument,
	);
	const http = createTestHttp(handlers);
	return validateProduct(http, "test", { productId: "100" });
};

const listCodes = (productReport: { findings: { code: string }[] }) =>
	productReport.findings.map((finding) => finding.code);

describe("validateProduct", () => {
	test("passes a published product with a published variant", async () => {
		const handlers = createPublishedProductHandlers(
			200,
			VARIANTS_COLLECTION_PUBLISHED,
		);
		const http = createTestHttp(handlers);

		const productReport = await validateProduct(http, "test", {
			productId: "100",
			expectedStoreId: "42",
		});

		expect(productReport.ok).toBe(true);
		expect(productReport.findings).toHaveLength(0);
		expect(productReport.target).toEqual({ label: "Pro Plan", id: "100" });
	});

	test("passes a product whose only variant is the pending default variant", async () => {
		const productReport = await validatePublishedProduct(
			200,
			VARIANTS_COLLECTION_DEFAULT_ONLY,
		);

		expect(productReport.ok).toBe(true);
		expect(productReport.findings).toHaveLength(0);
	});

	test("flags VARIANT_UNPUBLISHED when a pending variant has only draft siblings", async () => {
		const productReport = await validatePublishedProduct(
			200,
			VARIANTS_COLLECTION_PENDING_AND_DRAFT,
		);

		expect(productReport.ok).toBe(false);
		expect(listCodes(productReport)).toContain("VARIANT_UNPUBLISHED");
	});

	test("flags an unpublished product, a missing buy URL and draft-only variants", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/products/101", UNPUBLISHED_PRODUCT_DOCUMENT),
			replyToVariantList("101", VARIANTS_COLLECTION_ALL_DRAFT),
		]);

		const productReport = await validateProduct(http, "test", {
			productId: "101",
		});

		const unpublishedFinding = productReport.findings.find(
			(finding) => finding.code === "PRODUCT_UNPUBLISHED",
		);
		const buyUrlFinding = productReport.findings.find(
			(finding) => finding.code === "PRODUCT_NO_BUY_URL",
		);
		expect(productReport.ok).toBe(false);
		expect(unpublishedFinding?.severity).toBe("error");
		expect(unpublishedFinding?.context).toEqual({ status: "draft" });
		expect(buyUrlFinding?.severity).toBe("warning");
		expect(listCodes(productReport)).toContain("VARIANT_UNPUBLISHED");
	});

	test("flags a product on another store when expectedStoreId differs", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/products/102", PRODUCT_ON_WRONG_STORE_DOCUMENT),
			replyToVariantList("102", VARIANTS_COLLECTION_PUBLISHED),
		]);

		const productReport = await validateProduct(http, "test", {
			productId: "102",
			expectedStoreId: "42",
		});

		expect(productReport.ok).toBe(false);
		expect(listCodes(productReport)).toContain("PRODUCT_WRONG_STORE");
	});

	test("skips the store check when no expectedStoreId is given", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/products/102", PRODUCT_ON_WRONG_STORE_DOCUMENT),
			replyToVariantList("102", VARIANTS_COLLECTION_PUBLISHED),
		]);

		const productReport = await validateProduct(http, "test", {
			productId: "102",
		});

		expect(productReport.ok).toBe(true);
		expect(listCodes(productReport)).not.toContain("PRODUCT_WRONG_STORE");
	});

	test("returns PRODUCT_NOT_FOUND on a 404", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/products/9999", NOT_FOUND_ERROR, 404),
		]);

		const productReport = await validateProduct(http, "test", {
			productId: "9999",
		});

		expect(productReport.ok).toBe(false);
		expect(productReport.findings[0]?.code).toBe("PRODUCT_NOT_FOUND");
		expect(productReport.target).toEqual({ label: "product 9999", id: "9999" });
	});

	test("returns AUTH_FAILED when the key is rejected", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/products/100", UNAUTHORIZED_ERROR, 401),
		]);

		const productReport = await validateProduct(http, "test", {
			productId: "100",
		});

		expect(productReport.ok).toBe(false);
		expect(productReport.findings[0]?.code).toBe("AUTH_FAILED");
	});

	test("flags VARIANT_MISSING when no variants exist", async () => {
		const productReport = await validatePublishedProduct(
			200,
			VARIANTS_COLLECTION_EMPTY,
		);

		expect(productReport.ok).toBe(false);
		expect(listCodes(productReport)).toEqual(["VARIANT_MISSING"]);
	});

	test("turns a failed variant listing into a warning without failing the check", async () => {
		const productReport = await validatePublishedProduct(500, {
			errors: [{ detail: "upstream" }],
		});

		const variantFinding = productReport.findings.find(
			(finding) => finding.code === "UNKNOWN",
		);
		expect(productReport.ok).toBe(true);
		expect(variantFinding?.severity).toBe("warning");
	});
});
