import { makeHttp, route } from "@e2e/mock-fetch.js";
import { NOT_FOUND_ERROR, UNAUTHORIZED_ERROR } from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { createFreshSqueezyError } from "@/client/errors.js";
import { validateConnection } from "./connection.js";
import { validateDiscount } from "./discount.js";
import {
	fetchCollection,
	fetchResource,
	fetchSafely,
	type NotFoundFinding,
	storeMismatchFindings,
} from "./fetch-resource.js";
import { validateLicenseKey } from "./license-key.js";
import { validateProduct } from "./product.js";
import { validateStore } from "./store.js";
import { validateSubscriptionPlan } from "./subscription-plan.js";
import { validateWebhook } from "./webhook.js";

const PRODUCT_NOT_FOUND: NotFoundFinding = {
	code: "PRODUCT_NOT_FOUND",
	message: "Product not found.",
};

const readFailureFinding = async (
	thrown: unknown,
	notFound?: NotFoundFinding,
) => {
	const lookup = await fetchSafely(async () => {
		throw thrown;
	}, notFound);
	const isFound = lookup.kind === "found";
	if (isFound) throw new Error("expected a failed fetch");
	return lookup.finding;
};

const createRejectedKeyHttp = () =>
	makeHttp([
		{ accepts: () => true, status: 401, replyDocument: UNAUTHORIZED_ERROR },
	]);

const REJECTED_KEY_CASES = [
	{
		name: "connection",
		validate: () => validateConnection(createRejectedKeyHttp(), "test"),
	},
	{
		name: "store",
		validate: () => validateStore(createRejectedKeyHttp(), "test", "42"),
	},
	{
		name: "product",
		validate: () =>
			validateProduct(createRejectedKeyHttp(), "test", { productId: "100" }),
	},
	{
		name: "webhook",
		validate: () =>
			validateWebhook(createRejectedKeyHttp(), "test", {
				storeId: "42",
				url: "https://example.com/hook",
			}),
	},
	{
		name: "discount",
		validate: () =>
			validateDiscount(createRejectedKeyHttp(), "test", {
				storeId: "42",
				discountId: "600",
			}),
	},
	{
		name: "license key",
		validate: () =>
			validateLicenseKey(createRejectedKeyHttp(), "test", {
				storeId: "42",
				licenseKeyId: "700",
			}),
	},
	{
		name: "subscription plan",
		validate: () =>
			validateSubscriptionPlan(createRejectedKeyHttp(), "test", {
				storeId: "42",
				variantId: "800",
			}),
	},
];

describe("fetchSafely", () => {
	test("returns the resource on success", async () => {
		const lookup = await fetchSafely(async () => ({ id: 1 }));

		expect(lookup).toEqual({ kind: "found", resource: { id: 1 } });
	});

	test("turns a 404 into the caller-supplied not-found finding", async () => {
		const missing = createFreshSqueezyError({
			code: "NOT_FOUND",
			status: 404,
			message: "missing",
		});

		const finding = await readFailureFinding(missing, {
			...PRODUCT_NOT_FOUND,
			suggestedFix: "Verify the ID.",
			context: { productId: "99" },
		});

		expect(finding.code).toBe("PRODUCT_NOT_FOUND");
		expect(finding.severity).toBe("error");
		expect(finding.suggestedFix).toBe("Verify the ID.");
		expect(finding.context).toEqual({ productId: "99" });
	});

	test("turns a 404 into UNKNOWN when no not-found finding is given", async () => {
		const missing = createFreshSqueezyError({
			code: "NOT_FOUND",
			status: 404,
			message: "missing",
		});

		const finding = await readFailureFinding(missing);

		expect(finding.code).toBe("UNKNOWN");
		expect(finding.context).toEqual({ status: 404, code: "NOT_FOUND" });
	});

	test("keeps UNKNOWN for a non-404 error even when a not-found finding is given", async () => {
		const serverFailure = createFreshSqueezyError({
			code: "SERVER_ERROR",
			status: 500,
			message: "broken",
		});

		const finding = await readFailureFinding(serverFailure, PRODUCT_NOT_FOUND);

		expect(finding.code).toBe("UNKNOWN");
		expect(finding.message).toBe("broken");
	});

	test("turns a 401 into AUTH_FAILED with the settings link", async () => {
		const rejected = createFreshSqueezyError({
			code: "UNAUTHORIZED",
			status: 401,
			message: "no",
		});

		const finding = await readFailureFinding(rejected, PRODUCT_NOT_FOUND);

		expect(finding.code).toBe("AUTH_FAILED");
		expect(finding.message).toBe("API key rejected by Lemon Squeezy.");
		expect(finding.suggestedFix).toContain(
			"https://app.lemonsqueezy.com/settings/api",
		);
		expect(finding.context).toEqual({ status: 401 });
	});

	test("turns the UNAUTHORIZED code into AUTH_FAILED even without a status", async () => {
		const rejected = createFreshSqueezyError({
			code: "UNAUTHORIZED",
			message: "no",
		});

		const finding = await readFailureFinding(rejected);

		expect(finding.code).toBe("AUTH_FAILED");
	});

	test("turns NETWORK_ERROR into a network finding", async () => {
		const networkFailure = createFreshSqueezyError({
			code: "NETWORK_ERROR",
			message: "boom",
		});

		const finding = await readFailureFinding(networkFailure);

		expect(finding.code).toBe("NETWORK_ERROR");
		expect(finding.message).toBe("Could not reach Lemon Squeezy: boom");
	});

	test("turns other API errors into UNKNOWN with status and code", async () => {
		const rateLimited = createFreshSqueezyError({
			code: "RATE_LIMITED",
			status: 429,
			message: "slow down",
		});

		const finding = await readFailureFinding(rateLimited);

		expect(finding.code).toBe("UNKNOWN");
		expect(finding.context).toEqual({ status: 429, code: "RATE_LIMITED" });
	});

	test("shows a missing status as null in the UNKNOWN context", async () => {
		const statusless = createFreshSqueezyError({
			code: "PARSE_ERROR",
			message: "bad body",
		});

		const finding = await readFailureFinding(statusless);

		expect(finding.context).toEqual({ status: null, code: "PARSE_ERROR" });
	});

	test("turns a plain Error into UNKNOWN with its message", async () => {
		const finding = await readFailureFinding(new Error("oops"));

		expect(finding.code).toBe("UNKNOWN");
		expect(finding.severity).toBe("error");
		expect(finding.message).toBe("oops");
	});

	test("turns a thrown non-error into UNKNOWN", async () => {
		const finding = await readFailureFinding("a string");

		expect(finding.code).toBe("UNKNOWN");
		expect(finding.message).toBe("Unknown error");
	});

	test.each(REJECTED_KEY_CASES)(
		"gives AUTH_FAILED for the $name check on a 401",
		async ({ validate }) => {
			const checkReport = await validate();

			expect(checkReport.ok).toBe(false);
			expect(checkReport.findings[0]?.code).toBe("AUTH_FAILED");
			expect(checkReport.findings[0]?.suggestedFix).toContain(
				"https://app.lemonsqueezy.com/settings/api",
			);
		},
	);
});

describe("fetchResource", () => {
	test("returns the attributes of the resource", async () => {
		const http = makeHttp([
			route("/v1/stores/1", {
				data: { id: "1", type: "stores", attributes: { name: "S" } },
			}),
		]);

		const lookup = await fetchResource<{ name: string }>(http, {
			path: "/v1/stores/1",
			notFound: PRODUCT_NOT_FOUND,
		});

		expect(lookup).toEqual({ kind: "found", resource: { name: "S" } });
	});

	test("uses the not-found finding on a 404", async () => {
		const http = makeHttp([route("/v1/stores/1", NOT_FOUND_ERROR, 404)]);

		const lookup = await fetchResource(http, {
			path: "/v1/stores/1",
			notFound: PRODUCT_NOT_FOUND,
		});

		expect(lookup).toEqual({
			kind: "failed",
			finding: { ...PRODUCT_NOT_FOUND, severity: "error" },
		});
	});
});

describe("fetchCollection", () => {
	test("returns every resource of the collection", async () => {
		const http = makeHttp([
			route("/v1/stores", {
				data: [
					{ id: "1", type: "stores", attributes: {} },
					{ id: "2", type: "stores", attributes: {} },
				],
			}),
		]);

		const lookup = await fetchCollection(http, { path: "/v1/stores" });

		const isFound = lookup.kind === "found";
		expect(isFound).toBe(true);
		expect(isFound && lookup.resource.map((store) => store.id)).toEqual([
			"1",
			"2",
		]);
	});

	test("fails with UNKNOWN on a 404 because a collection has no not-found finding", async () => {
		const http = makeHttp([route("/v1/stores", NOT_FOUND_ERROR, 404)]);

		const lookup = await fetchCollection(http, { path: "/v1/stores" });

		const isFailed = lookup.kind === "failed";
		expect(isFailed && lookup.finding.code).toBe("UNKNOWN");
	});
});

describe("storeMismatchFindings", () => {
	test("returns nothing when the stores match", () => {
		const findings = storeMismatchFindings({
			label: "Discount",
			code: "DISCOUNT_STORE_MISMATCH",
			expectedStoreId: "42",
			actualStoreId: 42,
			suggestedFix: "Fix it.",
		});

		expect(findings).toEqual([]);
	});

	test("returns one finding with the extra details when the stores differ", () => {
		const [finding] = storeMismatchFindings({
			label: "Discount",
			code: "DISCOUNT_STORE_MISMATCH",
			expectedStoreId: "42",
			actualStoreId: 99,
			suggestedFix: "Use the correct store.",
			extraDetails: { discountId: "7" },
		});

		expect(finding?.code).toBe("DISCOUNT_STORE_MISMATCH");
		expect(finding?.severity).toBe("error");
		expect(finding?.message).toBe("Discount belongs to store 99, expected 42.");
		expect(finding?.suggestedFix).toBe("Use the correct store.");
		expect(finding?.context).toEqual({
			expectedStoreId: "42",
			actualStoreId: "99",
			discountId: "7",
		});
	});

	test("works without extra details", () => {
		const [finding] = storeMismatchFindings({
			label: "Product",
			code: "PRODUCT_WRONG_STORE",
			expectedStoreId: "42",
			actualStoreId: 99,
			suggestedFix: "Use the correct store.",
		});

		expect(finding?.context).toEqual({
			expectedStoreId: "42",
			actualStoreId: "99",
		});
	});
});
