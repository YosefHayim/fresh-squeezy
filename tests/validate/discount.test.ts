import { describe, expect, it } from "vitest";
import { HttpClient } from "../../src/core/http.js";
import { resolveConfig } from "../../src/core/config.js";
import { validateDiscount } from "../../src/validate/discount.js";
import { createMockFetch, pathIs } from "../helpers/mockFetch.js";
import {
  notFoundError,
  publishedDiscountDoc,
  draftDiscountDoc,
  expiredDiscountDoc,
  futureDiscountDoc,
  exhaustedDiscountDoc,
  invalidPercentDiscountDoc,
  zeroAmountDiscountDoc,
  wrongStoreDiscountDoc,
} from "../fixtures/sandbox/data.js";

function makeClient(routes: Parameters<typeof createMockFetch>[0]) {
  const { fetch } = createMockFetch(routes);
  return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
}

describe("validateDiscount", () => {
  it("returns ok for a valid published discount", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/600"), status: 200, body: publishedDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 600 });
    expect(result.ok).toBe(true);
    expect(result.resource?.code).toBe("SUMMER20");
    expect(result.issues).toHaveLength(0);
  });

  it("returns DISCOUNT_NOT_FOUND on 404", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/9999"), status: 404, body: notFoundError },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 9999 });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("DISCOUNT_NOT_FOUND");
  });

  it("returns DISCOUNT_DRAFT for draft status", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/601"), status: 200, body: draftDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 601 });
    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("DISCOUNT_DRAFT");
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("returns DISCOUNT_EXPIRED for past expires_at", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/602"), status: 200, body: expiredDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 602 });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("DISCOUNT_EXPIRED");
  });

  it("returns DISCOUNT_NOT_STARTED for future starts_at", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/603"), status: 200, body: futureDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 603 });
    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("DISCOUNT_NOT_STARTED");
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("returns DISCOUNT_REDEMPTIONS_EXHAUSTED when limited and max ≤ 0", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/604"), status: 200, body: exhaustedDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 604 });
    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("DISCOUNT_REDEMPTIONS_EXHAUSTED");
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("returns DISCOUNT_INVALID_AMOUNT for percent > 100", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/605"), status: 200, body: invalidPercentDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 605 });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("DISCOUNT_INVALID_AMOUNT");
  });

  it("returns DISCOUNT_INVALID_AMOUNT for amount ≤ 0", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/606"), status: 200, body: zeroAmountDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 606 });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("DISCOUNT_INVALID_AMOUNT");
  });

  it("returns DISCOUNT_STORE_MISMATCH for wrong store", async () => {
    const http = makeClient([
      { match: pathIs("/v1/discounts/607"), status: 200, body: wrongStoreDiscountDoc },
    ]);
    const result = await validateDiscount(http, "test", { storeId: 42, discountId: 607 });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("DISCOUNT_STORE_MISMATCH");
  });
});
