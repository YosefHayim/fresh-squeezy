import {
	NOT_FOUND_ERROR,
	UNAUTHORIZED_ERROR,
} from "@e2e/sandbox-store.js";
import { makeHttp, route } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { freshSqueezyErrorOf } from "@/client/errors.js";
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

const NOT_FOUND: NotFoundFinding = {
	code: "PRODUCT_NOT_FOUND",
	message: "x not found.",
};

const failureOf = async (thrown: unknown, notFound?: NotFoundFinding) => {
	const fetched = await fetchSafely(async () => {
		throw thrown;
	}, notFound);
	const isFound = fetched.kind === "found";
	if (isFound) throw new Error("expected a failed fetch");
	return fetched.finding;
};

test("fetchSafely returns the payload on success", async () => {
	const fetched = await fetchSafely(async () => ({ id: 1 }));

	expect(fetched).toEqual({ kind: "found", payload: { id: 1 } });
});

test("fetchSafely maps a 404 to the caller-supplied not-found finding", async () => {
	const missing = freshSqueezyErrorOf({
		code: "NOT_FOUND",
		status: 404,
		message: "missing",
	});

	const finding = await failureOf(missing, {
		...NOT_FOUND,
		suggestedFix: "Verify the ID.",
		context: { productId: "99" },
	});

	expect(finding.code).toBe("PRODUCT_NOT_FOUND");
	expect(finding.severity).toBe("error");
	expect(finding.suggestedFix).toBe("Verify the ID.");
	expect(finding.context).toEqual({ productId: "99" });
});

test("fetchSafely maps a 404 to UNKNOWN when no not-found finding is given", async () => {
	const missing = freshSqueezyErrorOf({
		code: "NOT_FOUND",
		status: 404,
		message: "missing",
	});

	const finding = await failureOf(missing);

	expect(finding.code).toBe("UNKNOWN");
});

test("fetchSafely maps a 401 to AUTH_FAILED with the settings link", async () => {
	const rejected = freshSqueezyErrorOf({
		code: "UNAUTHORIZED",
		status: 401,
		message: "no",
	});

	const finding = await failureOf(rejected, NOT_FOUND);

	expect(finding.code).toBe("AUTH_FAILED");
	expect(finding.message).toBe("API key rejected by Lemon Squeezy.");
	expect(finding.suggestedFix).toContain(
		"https://app.lemonsqueezy.com/settings/api",
	);
	expect(finding.context).toEqual({ status: 401 });
});

test("fetchSafely maps NETWORK_ERROR to a network finding", async () => {
	const finding = await failureOf(
		freshSqueezyErrorOf({ code: "NETWORK_ERROR", message: "boom" }),
	);

	expect(finding.code).toBe("NETWORK_ERROR");
	expect(finding.message).toContain("boom");
});

test("fetchSafely maps other API errors to UNKNOWN with status and code", async () => {
	const finding = await failureOf(
		freshSqueezyErrorOf({
			code: "RATE_LIMITED",
			status: 429,
			message: "slow down",
		}),
	);

	expect(finding.code).toBe("UNKNOWN");
	expect(finding.context).toEqual({ status: 429, code: "RATE_LIMITED" });
});

test("fetchSafely maps a plain Error to UNKNOWN with its message", async () => {
	const finding = await failureOf(new Error("oops"));

	expect(finding.code).toBe("UNKNOWN");
	expect(finding.message).toBe("oops");
});

test("fetchSafely maps a thrown non-error to UNKNOWN", async () => {
	const finding = await failureOf("text");

	expect(finding.message).toBe("Unknown error");
});

test("fetchResource returns the attributes of the resource", async () => {
	const http = makeHttp([
		route("/v1/stores/1", {
			data: { id: "1", type: "stores", attributes: { name: "S" } },
		}),
	]);

	const fetched = await fetchResource<{ name: string }>(http, {
		path: "/v1/stores/1",
		notFound: NOT_FOUND,
	});

	expect(fetched).toEqual({ kind: "found", payload: { name: "S" } });
});

test("fetchResource uses the not-found finding on a 404", async () => {
	const http = makeHttp([route("/v1/stores/1", NOT_FOUND_ERROR, 404)]);

	const fetched = await fetchResource(http, {
		path: "/v1/stores/1",
		notFound: NOT_FOUND,
	});

	expect(fetched.kind).toBe("failed");
});

test("fetchCollection returns every resource of the collection", async () => {
	const http = makeHttp([
		route("/v1/stores", {
			data: [{ id: "1", type: "stores", attributes: {} }],
		}),
	]);

	const fetched = await fetchCollection(http, { path: "/v1/stores" });

	expect(fetched.kind).toBe("found");
});

test("storeMismatchFindings is empty when the stores match", () => {
	const findings = storeMismatchFindings({
		label: "X",
		code: "DISCOUNT_STORE_MISMATCH",
		expectedStoreId: "42",
		actualStoreId: 42,
		suggestedFix: "Fix it.",
	});

	expect(findings).toEqual([]);
});

test("storeMismatchFindings returns one finding when the stores differ", () => {
	const [finding] = storeMismatchFindings({
		label: "Discount",
		code: "DISCOUNT_STORE_MISMATCH",
		expectedStoreId: "42",
		actualStoreId: 99,
		suggestedFix: "Use the correct store.",
		extraContext: { discountId: "7" },
	});

	expect(finding?.code).toBe("DISCOUNT_STORE_MISMATCH");
	expect(finding?.message).toBe("Discount belongs to store 99, expected 42.");
	expect(finding?.context).toEqual({
		expectedStoreId: "42",
		actualStoreId: "99",
		discountId: "7",
	});
});

const rejectedKeyHttp = () =>
	makeHttp([{ match: () => true, status: 401, body: UNAUTHORIZED_ERROR }]);

const REJECTED_KEY_CASES = [
	{
		name: "connection",
		validate: () => validateConnection(rejectedKeyHttp(), "test"),
	},
	{
		name: "store",
		validate: () => validateStore(rejectedKeyHttp(), "test", "42"),
	},
	{
		name: "product",
		validate: () =>
			validateProduct(rejectedKeyHttp(), "test", { productId: "100" }),
	},
	{
		name: "webhook",
		validate: () =>
			validateWebhook(rejectedKeyHttp(), "test", {
				storeId: "42",
				url: "https://example.com/hook",
			}),
	},
	{
		name: "discount",
		validate: () =>
			validateDiscount(rejectedKeyHttp(), "test", {
				storeId: "42",
				discountId: "600",
			}),
	},
	{
		name: "license key",
		validate: () =>
			validateLicenseKey(rejectedKeyHttp(), "test", {
				storeId: "42",
				licenseKeyId: "700",
			}),
	},
	{
		name: "subscription plan",
		validate: () =>
			validateSubscriptionPlan(rejectedKeyHttp(), "test", {
				storeId: "42",
				variantId: "800",
			}),
	},
];

test.each(REJECTED_KEY_CASES)(
	"$name check gives AUTH_FAILED on a 401",
	async ({ validate }) => {
		const validation = await validate();

		expect(validation.ok).toBe(false);
		expect(validation.findings[0]?.code).toBe("AUTH_FAILED");
		expect(validation.findings[0]?.suggestedFix).toContain(
			"https://app.lemonsqueezy.com/settings/api",
		);
	},
);
