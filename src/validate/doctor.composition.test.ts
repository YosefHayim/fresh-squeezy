import { describe, expect, it } from "vitest";
import { createFakeValidators } from "../../tests/helpers/fakeValidators.js";
import type { HttpClient } from "../core/http.js";
import { doctor } from "./doctor.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

/**
 * Composition tests for `doctor`. These exercise ordering, short-circuiting
 * on connection failure, and option-driven skipping — without setting up
 * HTTP routes. They survive any refactor to a validator's resource fetches
 * because they don't pretend to know which URLs the validator hits.
 */

const HTTP_STUB = {} as HttpClient;

describe("doctor composition", () => {
  it("runs validators in the documented order when every target is configured", async () => {
    const calls: string[] = [];
    const track = (name: string) => async (_http: HttpClient, mode: "test" | "live") => {
      calls.push(name);
      return buildResult(name, mode, []);
    };

    const validators = createFakeValidators({
      connection: track("connection"),
      store: track("store"),
      product: track("product"),
      webhook: track("webhook"),
      discount: track("discount"),
      licenseKey: track("licenseKey"),
      subscriptionPlan: track("subscriptionPlan"),
    });

    const report = await doctor(
      HTTP_STUB,
      "test",
      {
        storeId: 42,
        productId: 100,
        webhookUrl: "https://x/y",
        discountId: 600,
        licenseKeyId: 700,
        variantId: 800,
      },
      validators,
    );

    expect(report.ok).toBe(true);
    expect(calls).toEqual([
      "connection",
      "store",
      "product",
      "webhook",
      "discount",
      "licenseKey",
      "subscriptionPlan",
    ]);
  });

  it("short-circuits when connection fails and never invokes downstream validators", async () => {
    const downstreamCalls: string[] = [];
    const validators = createFakeValidators({
      connection: async (_http, mode) =>
        buildResult("connection", mode, [
          issue(ISSUE_CODES.AUTH_FAILED, "error", "API key rejected by Lemon Squeezy."),
        ]),
      store: async (_http, mode) => {
        downstreamCalls.push("store");
        return buildResult("store", mode, []);
      },
      product: async (_http, mode) => {
        downstreamCalls.push("product");
        return buildResult("product", mode, []);
      },
    });

    const report = await doctor(HTTP_STUB, "test", { storeId: 42, productId: 100 }, validators);

    expect(report.ok).toBe(false);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]?.name).toBe("connection");
    expect(downstreamCalls).toEqual([]);
  });

  it("propagates expectedStoreId from options.storeId into the product validator", async () => {
    let captured: { productId: string | number; expectedStoreId?: string | number } | null = null;
    const validators = createFakeValidators({
      product: async (_http, mode, options) => {
        captured = { productId: options.productId, expectedStoreId: options.expectedStoreId };
        return buildResult("product", mode, []);
      },
    });

    await doctor(HTTP_STUB, "test", { storeId: 42, productId: 100 }, validators);

    expect(captured).toEqual({ productId: 100, expectedStoreId: 42 });
  });

  it("runs one validator result per plural configured target", async () => {
    const calls: string[] = [];
    const validators = createFakeValidators({
      product: async (_http, mode, options) => {
        calls.push(`product:${options.productId}`);
        return buildResult("product", mode, []);
      },
      webhook: async (_http, mode, options) => {
        calls.push(`webhook:${options.url}`);
        return buildResult("webhook", mode, []);
      },
      discount: async (_http, mode, options) => {
        calls.push(`discount:${options.discountId}`);
        return buildResult("discount", mode, []);
      },
      licenseKey: async (_http, mode, options) => {
        calls.push(`licenseKey:${options.licenseKeyId}`);
        return buildResult("licenseKey", mode, []);
      },
      subscriptionPlan: async (_http, mode, options) => {
        calls.push(`subscriptionPlan:${options.variantId}`);
        return buildResult("subscriptionPlan", mode, []);
      },
    });

    const report = await doctor(
      HTTP_STUB,
      "test",
      {
        storeId: 42,
        productIds: [100, 101],
        webhookUrls: ["https://a.test", "https://b.test"],
        discountIds: [600, 601],
        licenseKeyIds: [700, 701],
        variantIds: [800, 801],
      },
      validators,
    );

    expect(report.ok).toBe(true);
    expect(calls).toEqual([
      "product:100",
      "product:101",
      "webhook:https://a.test",
      "webhook:https://b.test",
      "discount:600",
      "discount:601",
      "licenseKey:700",
      "licenseKey:701",
      "subscriptionPlan:800",
      "subscriptionPlan:801",
    ]);
    expect(report.results).toHaveLength(12);
  });

  it("throws DOCTOR_OPTIONS_INVALID when a dependent option is set without storeId", async () => {
    const validators = createFakeValidators();

    for (const opts of [
      { discountId: 1 },
      { discountIds: [1] },
      { licenseKeyId: 1 },
      { licenseKeyIds: [1] },
      { webhookUrl: "https://x" },
      { webhookUrls: ["https://x"] },
      { variantId: 1 },
      { variantIds: [1] },
    ]) {
      await expect(doctor(HTTP_STUB, "test", opts, validators)).rejects.toMatchObject({
        name: "FreshSqueezyError",
        code: "DOCTOR_OPTIONS_INVALID",
      });
    }
  });

  it("does not throw when only productId is set without storeId (cross-store check is optional)", async () => {
    const validators = createFakeValidators();
    const report = await doctor(HTTP_STUB, "test", { productId: 100 }, validators);
    expect(report.ok).toBe(true);
    expect(report.results.map((r) => r.name)).toEqual(["connection", "product"]);
  });

  it("marks report.ok false when any downstream validator reports an error", async () => {
    const validators = createFakeValidators({
      discount: async (_http, mode) =>
        buildResult("discount", mode, [
          issue(ISSUE_CODES.DISCOUNT_NOT_FOUND, "error", "Discount 9 not found."),
        ]),
    });

    const report = await doctor(HTTP_STUB, "test", { storeId: 42, discountId: 9 }, validators);

    expect(report.ok).toBe(false);
    expect(report.results.find((r) => r.name === "discount")?.ok).toBe(false);
  });
});
