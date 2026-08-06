import { describe, expect, it } from "vitest";
import {
  notFoundError,
  productOnWrongStoreDoc,
  publishedProductDoc,
  unpublishedProductDoc,
  variantsCollectionAllDraft,
  variantsCollectionEmpty,
  variantsCollectionPublished,
} from "../../tests/fixtures/sandbox/data.js";
import { createMockFetch, pathIs, pathIsWithQuery } from "../../tests/helpers/mockFetch.js";
import { resolveConfig } from "../core/config.js";
import { HttpClient } from "../core/http.js";
import { validateProduct } from "./product.js";

const makeClient = (routes: Parameters<typeof createMockFetch>[0]) => {
  const { fetch } = createMockFetch(routes);
  return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
};

describe("validateProduct", () => {
  it("passes a published product with a published variant", async () => {
    const http = makeClient([
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
        status: 200,
        body: variantsCollectionPublished,
      },
    ]);

    const result = await validateProduct(http, "test", { productId: 100, expectedStoreId: 42 });

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags unpublished product and draft-only variants", async () => {
    const http = makeClient([
      { match: pathIs("/v1/products/101"), status: 200, body: unpublishedProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "101" }),
        status: 200,
        body: variantsCollectionAllDraft,
      },
    ]);

    const result = await validateProduct(http, "test", { productId: 101 });

    expect(result.ok).toBe(false);
    const codes = result.issues.map((entry) => entry.code);
    expect(codes).toContain("PRODUCT_UNPUBLISHED");
    expect(codes).toContain("VARIANT_UNPUBLISHED");
    expect(codes).toContain("PRODUCT_NO_BUY_URL");
  });

  it("flags product on wrong store when expectedStoreId mismatches", async () => {
    const http = makeClient([
      { match: pathIs("/v1/products/102"), status: 200, body: productOnWrongStoreDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "102" }),
        status: 200,
        body: variantsCollectionPublished,
      },
    ]);

    const result = await validateProduct(http, "test", {
      productId: 102,
      expectedStoreId: 42,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain("PRODUCT_WRONG_STORE");
  });

  it("returns PRODUCT_NOT_FOUND on 404", async () => {
    const http = makeClient([
      { match: pathIs("/v1/products/9999"), status: 404, body: notFoundError },
    ]);
    const result = await validateProduct(http, "test", { productId: 9999 });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("flags VARIANT_MISSING when no variants exist", async () => {
    const http = makeClient([
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
        status: 200,
        body: variantsCollectionEmpty,
      },
    ]);

    const result = await validateProduct(http, "test", { productId: 100 });

    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain("VARIANT_MISSING");
  });

  it("soft-fails variant listing as a warning without failing the product check", async () => {
    const http = makeClient([
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
        status: 500,
        body: { errors: [{ detail: "upstream" }] },
      },
    ]);

    const result = await validateProduct(http, "test", { productId: 100 });

    expect(result.ok).toBe(true);
    const variantIssue = result.issues.find((entry) => entry.code === "UNKNOWN");
    expect(variantIssue?.severity).toBe("warning");
  });
});
