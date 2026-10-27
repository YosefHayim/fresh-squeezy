import { unauthorizedError } from "@e2e/fixtures/sandbox/data.js";
import { makeClient } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { freshSqueezyErrorOf } from "@/shared/errors.js";
import { validateConnection } from "./connection.js";
import { validateDiscount } from "./discount.js";
import { validateLicenseKey } from "./license-key.js";
import { checkStoreOwnership, mapErrorToIssue, probeFetch } from "./probe.js";
import { validateProduct } from "./product.js";
import { validateStore } from "./store.js";
import { validateSubscriptionPlan } from "./subscription-plan.js";
import { validateWebhook } from "./webhook.js";

const probeThrowing = (thrown: Error) => {
	return probeFetch(
		async () => {
			throw thrown;
		},
		{ code: "X_NOT_FOUND", message: "x" },
	);
};

test("probeFetch returns the resource on success", async () => {
	const probeOutcome = await probeFetch(async () => ({ id: 1 }), {
		code: "PRODUCT_NOT_FOUND",
		message: "Product not found.",
	});
	expect(probeOutcome).toEqual({ ok: true, resource: { id: 1 } });
});

test("probeFetch maps a 404 to the caller-supplied notFoundCode", async () => {
	const probeOutcome = await probeFetch(
		async () => {
			throw freshSqueezyErrorOf({
				code: "NOT_FOUND",
				status: 404,
				message: "missing",
			});
		},
		{
			code: "PRODUCT_NOT_FOUND",
			message: "Product 99 not found.",
			suggestedFix: "Verify the ID.",
			context: { productId: "99" },
		},
	);
	expect(probeOutcome.ok).toBe(false);
	if (probeOutcome.ok) return;
	expect(probeOutcome.issue.code).toBe("PRODUCT_NOT_FOUND");
	expect(probeOutcome.issue.message).toBe("Product 99 not found.");
	expect(probeOutcome.issue.suggestedFix).toBe("Verify the ID.");
	expect(probeOutcome.issue.context).toEqual({ productId: "99" });
});

test("probeFetch maps a NETWORK_ERROR to ISSUE_CODES.NETWORK_ERROR", async () => {
	const probeOutcome = await probeFetch(
		async () => {
			throw freshSqueezyErrorOf({ code: "NETWORK_ERROR", message: "boom" });
		},
		{ code: "X_NOT_FOUND", message: "x" },
	);
	expect(probeOutcome.ok).toBe(false);
	if (probeOutcome.ok) return;
	expect(probeOutcome.issue.code).toBe("NETWORK_ERROR");
	expect(probeOutcome.issue.message).toContain("boom");
});

test("probeFetch maps any other FreshSqueezyError to UNKNOWN with status + code context", async () => {
	const probeOutcome = await probeThrowing(
		freshSqueezyErrorOf({
			code: "RATE_LIMITED",
			status: 429,
			message: "slow down",
		}),
	);
	expect(probeOutcome.ok).toBe(false);
	if (probeOutcome.ok) return;
	expect(probeOutcome.issue.code).toBe("UNKNOWN");
	expect(probeOutcome.issue.context).toEqual({
		status: 429,
		code: "RATE_LIMITED",
	});
});

test("probeFetch maps non-FreshSqueezyError to UNKNOWN with the error message", async () => {
	const probeOutcome = await probeThrowing(new Error("oops"));
	expect(probeOutcome.ok).toBe(false);
	if (probeOutcome.ok) return;
	expect(probeOutcome.issue.code).toBe("UNKNOWN");
	expect(probeOutcome.issue.message).toBe("oops");
});

test("mapErrorToIssue maps 401 to AUTH_FAILED with the regenerate-key fix", () => {
	const mappedIssue = mapErrorToIssue(
		freshSqueezyErrorOf({ code: "UNAUTHORIZED", status: 401, message: "no" }),
	);
	expect(mappedIssue.code).toBe("AUTH_FAILED");
	expect(mappedIssue.message).toBe("API key rejected by Lemon Squeezy.");
	expect(mappedIssue.suggestedFix).toBe(
		"Regenerate the key at https://app.lemonsqueezy.com/settings/api.",
	);
	expect(mappedIssue.context).toEqual({ status: 401 });
});

test("checkStoreOwnership returns null when expected matches actual", () => {
	expect(
		checkStoreOwnership({
			expectedStoreId: 42,
			actualStoreId: 42,
			code: "X_STORE_MISMATCH",
			label: "X",
		}),
	).toEqual([]);
});

test("checkStoreOwnership treats numeric and string IDs as equal", () => {
	expect(
		checkStoreOwnership({
			expectedStoreId: "42",
			actualStoreId: 42,
			code: "X_STORE_MISMATCH",
			label: "X",
		}),
	).toEqual([]);
});

test("checkStoreOwnership returns a mismatch issue when IDs differ", () => {
	const [ownershipIssue] = checkStoreOwnership({
		expectedStoreId: "42",
		actualStoreId: "99",
		code: "DISCOUNT_STORE_MISMATCH",
		label: "Discount",
		suggestedFix: "Use the correct store.",
		extraContext: { discountId: "7" },
	});
	expect(ownershipIssue).not.toEqual([]);
	expect(ownershipIssue?.code).toBe("DISCOUNT_STORE_MISMATCH");
	expect(ownershipIssue?.severity).toBe("error");
	expect(ownershipIssue?.message).toBe(
		"Discount belongs to store 99, expected 42.",
	);
	expect(ownershipIssue?.suggestedFix).toBe("Use the correct store.");
	expect(ownershipIssue?.context).toEqual({
		expectedStoreId: "42",
		actualStoreId: "99",
		discountId: "7",
	});
});

const rejectedKeyClient = () =>
	makeClient([{ match: () => true, status: 401, body: unauthorizedError }]);

const validatorCases = [
	{
		name: "connection",
		validate: () => validateConnection(rejectedKeyClient(), "test"),
	},
	{
		name: "store",
		validate: () => validateStore(rejectedKeyClient(), "test", 42),
	},
	{
		name: "product",
		validate: () =>
			validateProduct(rejectedKeyClient(), "test", { productId: 100 }),
	},
	{
		name: "webhook",
		validate: () =>
			validateWebhook(rejectedKeyClient(), "test", {
				storeId: 42,
				url: "https://example.com/hook",
			}),
	},
	{
		name: "discount",
		validate: () =>
			validateDiscount(rejectedKeyClient(), "test", {
				storeId: 42,
				discountId: 600,
			}),
	},
	{
		name: "license key",
		validate: () =>
			validateLicenseKey(rejectedKeyClient(), "test", {
				storeId: 42,
				licenseKeyId: 700,
			}),
	},
	{
		name: "subscription plan",
		validate: () =>
			validateSubscriptionPlan(rejectedKeyClient(), "test", {
				storeId: 42,
				variantId: 800,
			}),
	},
];

test.each(validatorCases)(
	"$name validator gives AUTH_FAILED on a 401",
	async ({ validate }) => {
		const validation = await validate();
		expect(validation.ok).toBe(false);
		expect(validation.issues[0]?.code).toBe("AUTH_FAILED");
		expect(validation.issues[0]?.suggestedFix).toContain(
			"https://app.lemonsqueezy.com/settings/api",
		);
	},
);
