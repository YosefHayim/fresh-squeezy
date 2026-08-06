import { describe, expect, it, vi } from "vitest";
import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import { invokeOp } from "./invokeOp.js";

const fakeHttp = () => {
  const resource = { type: "webhooks", id: "1", attributes: { url: "https://x.test" } };
  return {
    getResource: vi.fn(async () => resource),
    postResource: vi.fn(async () => resource),
    patchResource: vi.fn(async () => resource),
    deleteResource: vi.fn(async () => undefined),
    paginate: vi.fn(async () => [resource]),
    request: vi.fn(async () => ({ data: resource, meta: { test_mode: true } })),
  } as unknown as HttpClient & {
    getResource: ReturnType<typeof vi.fn>;
    postResource: ReturnType<typeof vi.fn>;
    patchResource: ReturnType<typeof vi.fn>;
    deleteResource: ReturnType<typeof vi.fn>;
    paginate: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
  };
};

describe("invokeOp", () => {
  it("dispatches get product to getResource", async () => {
    const http = fakeHttp();
    await invokeOp(http, "product", "get", { id: 42 });
    expect(http.getResource).toHaveBeenCalledWith("/v1/products/42");
  });

  it("dispatches create webhook to postResource", async () => {
    const http = fakeHttp();
    const body = { data: { type: "webhooks" } };
    await invokeOp(http, "webhook", "create", { body });
    expect(http.postResource).toHaveBeenCalledWith("/v1/webhooks", body);
  });

  it("dispatches list product with store filter and list variant with parent", async () => {
    const http = fakeHttp();
    await invokeOp(http, "product", "list", { storeId: 7 });
    expect(http.paginate).toHaveBeenCalledWith("/v1/products", { "filter[store_id]": "7" });

    await invokeOp(http, "variant", "list", { parentId: 9 });
    expect(http.paginate).toHaveBeenCalledWith("/v1/variants", { "filter[product_id]": "9" });
  });

  it("dispatches write/action verbs through the right HTTP methods", async () => {
    const http = fakeHttp();
    const body = { data: { type: "subscriptions", id: "3", attributes: { variant_id: 2 } } };

    await invokeOp(http, "subscription", "update", { id: 3, body });
    expect(http.patchResource).toHaveBeenCalledWith("/v1/subscriptions/3", body);

    await invokeOp(http, "subscription", "cancel", { id: 3 });
    expect(http.request).toHaveBeenCalledWith({
      method: "DELETE",
      path: "/v1/subscriptions/3",
    });

    await invokeOp(http, "order", "refund", { id: 100 });
    expect(http.postResource).toHaveBeenCalledWith("/v1/orders/100/refund", {});

    await invokeOp(http, "order", "generate-invoice", { id: 100, body: { locale: "en" } });
    expect(http.request).toHaveBeenCalledWith({
      method: "POST",
      path: "/v1/orders/100/generate-invoice",
      body: { locale: "en" },
    });

    await invokeOp(http, "subscription-item", "current-usage", { id: 5 });
    expect(http.request).toHaveBeenCalledWith({
      path: "/v1/subscription-items/5/current-usage",
    });

    const deleted = await invokeOp(http, "webhook", "delete", { id: 12 });
    expect(http.deleteResource).toHaveBeenCalledWith("/v1/webhooks/12");
    expect(deleted).toBeUndefined();
  });

  it("returns user resource data from the authenticated-user document", async () => {
    const http = fakeHttp();
    const user = await invokeOp(http, "user", "get", {});
    expect(http.request).toHaveBeenCalledWith({ path: "/v1/users/me" });
    expect(user).toEqual({ type: "webhooks", id: "1", attributes: { url: "https://x.test" } });
  });

  it("rejects unknown ops and missing required args with FreshSqueezyError codes", async () => {
    const http = fakeHttp();

    await expect(invokeOp(http, "product", "create", {})).rejects.toMatchObject({
      code: "UNKNOWN_OP",
    });
    await expect(invokeOp(http, "product", "get", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
    });
    await expect(invokeOp(http, "product", "list", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
    });
    await expect(invokeOp(http, "variant", "list", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
    });
    await expect(invokeOp(http, "webhook", "create", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
    });
    await expect(invokeOp(http, "product", "get", {})).rejects.toBeInstanceOf(FreshSqueezyError);
  });
});
