import { expect, test } from "vitest";
import { freshSqueezyErrorOf } from "@/shared/errors.js";
import { checkStoreOwnership, mapErrorToIssue, probeFetch } from "./probe.js";

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

test("mapErrorToIssue maps 401 to the caller-supplied unauthorized code when present", () => {
	const mappedIssue = mapErrorToIssue(
		freshSqueezyErrorOf({ code: "UNAUTHORIZED", status: 401, message: "no" }),
		{
			unauthorized: {
				code: "AUTH_FAILED",
				message: "API key rejected by Lemon Squeezy.",
				suggestedFix: "Regenerate the key.",
			},
		},
	);
	expect(mappedIssue.code).toBe("AUTH_FAILED");
	expect(mappedIssue.suggestedFix).toBe("Regenerate the key.");
	expect(mappedIssue.context).toEqual({ status: 401 });
});

test("mapErrorToIssue falls through 401 to UNKNOWN when no unauthorized mapping is provided", () => {
	const mappedIssue = mapErrorToIssue(
		freshSqueezyErrorOf({ code: "UNAUTHORIZED", status: 401, message: "no" }),
	);
	expect(mappedIssue.code).toBe("UNKNOWN");
	expect(mappedIssue.context).toEqual({ status: 401, code: "UNAUTHORIZED" });
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
