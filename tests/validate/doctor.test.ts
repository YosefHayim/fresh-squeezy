import { describe, expect, it } from "vitest";
import { HttpClient } from "../../src/core/http.js";
import { resolveConfig } from "../../src/core/config.js";
import { doctor } from "../../src/validate/doctor.js";
import { createMockFetch, pathIs, pathIsWithQuery } from "../helpers/mockFetch.js";
import {
  publishedProductDoc,
  storeDoc,
  storesCollection,
  unauthorizedError,
  userDoc,
  variantsCollectionPublished,
  webhooksCollectionComplete,
  publishedDiscountDoc,
  activeLicenseKeyDoc,
  subscriptionVariantDoc,
} from "../fixtures/sandbox/data.js";

function makeClient(routes: Parameters<typeof createMockFetch>[0]) {
  const { fetch } = createMockFetch(routes);
  return new HttpClient(resolveConfig({ apiKey: "k", fetch, mode: "test" }));
}

describe("doctor", () => {
  it("stops at connection when auth fails", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 401, body: unauthorizedError },
    ]);

    const report = await doctor(http, "test", { storeId: 42, productId: 100 });

    expect(report.ok).toBe(false);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]?.name).toBe("connection");
  });

  it("runs every configured validator when connection succeeds", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
      {
        match: pathIsWithQuery("/v1/variants", { "filter[product_id]": "100" }),
        status: 200,
        body: variantsCollectionPublished,
      },
      {
        match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
        status: 200,
        body: webhooksCollectionComplete,
      },
    ]);

    const report = await doctor(http, "test", {
      storeId: 42,
      productId: 100,
      webhookUrl: "https://app.example.com/api/webhooks/lemon-squeezy",
    });

    expect(report.ok).toBe(true);
    expect(report.results.map((entry) => entry.name)).toEqual([
      "connection",
      "store",
      "product",
      "webhook",
    ]);
  });

  it("skips validators for targets that are not configured", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
    ]);

    const report = await doctor(http, "test");

    expect(report.results).toHaveLength(1);
    expect(report.results[0]?.name).toBe("connection");
  });

  it("runs discount validator when discountId is provided", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      { match: pathIs("/v1/discounts/600"), status: 200, body: publishedDiscountDoc },
    ]);

    const report = await doctor(http, "test", { storeId: 42, discountId: 600 });

    expect(report.ok).toBe(true);
    expect(report.results.some((r) => r.name === "discount")).toBe(true);
  });

  it("runs license key validator when licenseKeyId is provided", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      { match: pathIs("/v1/license-keys/700"), status: 200, body: activeLicenseKeyDoc },
    ]);

    const report = await doctor(http, "test", { storeId: 42, licenseKeyId: 700 });

    expect(report.ok).toBe(true);
    expect(report.results.some((r) => r.name === "licenseKey")).toBe(true);
  });

  it("runs subscription plan validator when variantId is provided", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      { match: pathIs("/v1/variants/800"), status: 200, body: subscriptionVariantDoc },
      { match: pathIs("/v1/products/100"), status: 200, body: publishedProductDoc },
    ]);

    const report = await doctor(http, "test", { storeId: 42, variantId: 800 });

    expect(report.ok).toBe(true);
    expect(report.results.some((r) => r.name === "subscriptionPlan")).toBe(true);
  });

  it("includes discount failure in overall ok", async () => {
    const http = makeClient([
      { match: pathIs("/v1/users/me"), status: 200, body: userDoc },
      { match: pathIs("/v1/stores"), status: 200, body: storesCollection },
      { match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
      { match: pathIs("/v1/discounts/9999"), status: 404, body: unauthorizedError },
    ]);

    const report = await doctor(http, "test", { storeId: 42, discountId: 9999 });

    expect(report.ok).toBe(false);
    expect(report.results.some((r) => r.name === "discount" && !r.ok)).toBe(true);
  });
});
