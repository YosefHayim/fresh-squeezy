import { describe, expect, it } from "vitest";
import { FreshSqueezyError } from "../core/errors.js";
import { checkStoreOwnership, mapErrorToIssue, probeFetch } from "./probe.js";

describe("probeFetch", () => {
  it("returns the resource on success", async () => {
    const result = await probeFetch(async () => ({ id: 1 }), {
      notFoundCode: "PRODUCT_NOT_FOUND",
      notFoundMessage: "Product not found.",
    });
    expect(result).toEqual({ ok: true, resource: { id: 1 } });
  });

  it("maps a 404 to the caller-supplied notFoundCode", async () => {
    const result = await probeFetch(
      async () => {
        throw new FreshSqueezyError({ code: "NOT_FOUND", status: 404, message: "missing" });
      },
      {
        notFoundCode: "PRODUCT_NOT_FOUND",
        notFoundMessage: "Product 99 not found.",
        notFoundFix: "Verify the ID.",
        notFoundContext: { productId: "99" },
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe("PRODUCT_NOT_FOUND");
    expect(result.issue.message).toBe("Product 99 not found.");
    expect(result.issue.suggestedFix).toBe("Verify the ID.");
    expect(result.issue.context).toEqual({ productId: "99" });
  });

  it("maps a NETWORK_ERROR to ISSUE_CODES.NETWORK_ERROR", async () => {
    const result = await probeFetch(
      async () => {
        throw new FreshSqueezyError({ code: "NETWORK_ERROR", message: "boom" });
      },
      { notFoundCode: "X_NOT_FOUND", notFoundMessage: "x" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe("NETWORK_ERROR");
    expect(result.issue.message).toContain("boom");
  });

  it("maps any other FreshSqueezyError to UNKNOWN with status + code context", async () => {
    const result = await probeFetch(
      async () => {
        throw new FreshSqueezyError({ code: "RATE_LIMITED", status: 429, message: "slow down" });
      },
      { notFoundCode: "X_NOT_FOUND", notFoundMessage: "x" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe("UNKNOWN");
    expect(result.issue.context).toEqual({ status: 429, code: "RATE_LIMITED" });
  });

  it("maps non-FreshSqueezyError to UNKNOWN with the error message", async () => {
    const result = await probeFetch(
      async () => {
        throw new Error("oops");
      },
      { notFoundCode: "X_NOT_FOUND", notFoundMessage: "x" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe("UNKNOWN");
    expect(result.issue.message).toBe("oops");
  });
});

describe("mapErrorToIssue", () => {
  it("maps 401 to the caller-supplied unauthorized code when present", () => {
    const result = mapErrorToIssue(
      new FreshSqueezyError({ code: "UNAUTHORIZED", status: 401, message: "no" }),
      {
        unauthorized: {
          code: "AUTH_FAILED",
          message: "API key rejected by Lemon Squeezy.",
          suggestedFix: "Regenerate the key.",
        },
      },
    );
    expect(result.code).toBe("AUTH_FAILED");
    expect(result.suggestedFix).toBe("Regenerate the key.");
    expect(result.context).toEqual({ status: 401 });
  });

  it("falls through 401 to UNKNOWN when no unauthorized mapping is provided", () => {
    const result = mapErrorToIssue(
      new FreshSqueezyError({ code: "UNAUTHORIZED", status: 401, message: "no" }),
    );
    expect(result.code).toBe("UNKNOWN");
    expect(result.context).toEqual({ status: 401, code: "UNAUTHORIZED" });
  });
});

describe("checkStoreOwnership", () => {
  it("returns null when expected matches actual", () => {
    expect(
      checkStoreOwnership({
        expectedStoreId: 42,
        actualStoreId: 42,
        code: "X_STORE_MISMATCH",
        label: "X",
      }),
    ).toBeNull();
  });

  it("treats numeric and string IDs as equal", () => {
    expect(
      checkStoreOwnership({
        expectedStoreId: "42",
        actualStoreId: 42,
        code: "X_STORE_MISMATCH",
        label: "X",
      }),
    ).toBeNull();
  });

  it("returns a mismatch issue when IDs differ", () => {
    const result = checkStoreOwnership({
      expectedStoreId: "42",
      actualStoreId: "99",
      code: "DISCOUNT_STORE_MISMATCH",
      label: "Discount",
      suggestedFix: "Use the correct store.",
      extraContext: { discountId: "7" },
    });
    expect(result).not.toBeNull();
    expect(result?.code).toBe("DISCOUNT_STORE_MISMATCH");
    expect(result?.severity).toBe("error");
    expect(result?.message).toBe("Discount belongs to store 99, expected 42.");
    expect(result?.suggestedFix).toBe("Use the correct store.");
    expect(result?.context).toEqual({
      expectedStoreId: "42",
      actualStoreId: "99",
      discountId: "7",
    });
  });
});
