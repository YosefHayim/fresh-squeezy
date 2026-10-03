import { describe, expect, it, vi } from "vitest";
import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import {
  type OpVerb,
  findResourceVerb,
  invokeOp,
  listRegisteredResources,
  listRegisteredVerbs,
  normalizeResourceName,
  resourceRegistry,
} from "./registry.js";

const KNOWN_VERBS: readonly OpVerb[] = [
  "get",
  "list",
  "create",
  "update",
  "delete",
  "cancel",
  "refund",
  "generate-invoice",
  "current-usage",
];

/** Catalog resources Lemon Squeezy documents as read-only. */
const READ_ONLY_RESOURCES = [
  "product",
  "variant",
  "price",
  "file",
  "store",
  "affiliate",
  "order-item",
  "discount-redemption",
  "license-key-instance",
] as const;

describe("resourceRegistry", () => {
  it("includes docs-backed webhook CRUD and excludes product create", () => {
    expect(findResourceVerb("webhook", "create")?.docsPath).toBe("webhooks/create-webhook");
    expect(findResourceVerb("webhook", "delete")?.destructive).toBe(true);
    expect(findResourceVerb("product", "get")).toBeDefined();
    expect(findResourceVerb("product", "create")).toBeUndefined();
    expect(findResourceVerb("products", "list")?.resource).toBe("product");
  });

  it("derives docs paths from the verb, with the one documented exception", () => {
    const docsPath = (resource: string, verb: OpVerb) => findResourceVerb(resource, verb)?.docsPath;
    expect(docsPath("store", "list")).toBe("stores/list-all-stores");
    expect(docsPath("order", "refund")).toBe("orders/issue-refund");
    expect(docsPath("order", "generate-invoice")).toBe("orders/generate-order-invoice");
    expect(docsPath("subscription-invoice", "generate-invoice")).toBe(
      "subscription-invoices/generate-subscription-invoice",
    );
    expect(docsPath("subscription-item", "current-usage")).toBe(
      "subscription-items/retrieve-subscription-item-current-usage",
    );
  });

  it("lists unique resources and only known verbs with docsPath", () => {
    const resources = listRegisteredResources();
    expect(resources).toContain("webhook");
    expect(resources).toContain("product");
    expect(resources).toEqual([...resources].sort());
    expect(new Set(resources).size).toBe(resources.length);
    expect(resourceRegistry.every((entry) => entry.docsPath.length > 0)).toBe(true);
    expect(resourceRegistry.every((entry) => KNOWN_VERBS.includes(entry.verb))).toBe(true);
  });

  it("normalizes plurals, underscores, and mixed case to singular keys", () => {
    expect(normalizeResourceName("products")).toBe("product");
    expect(normalizeResourceName("order_items")).toBe("order-item");
    expect(normalizeResourceName("subscription-invoices")).toBe("subscription-invoice");
    expect(normalizeResourceName("Webhook")).toBe("webhook");
    expect(normalizeResourceName("license_key_instances")).toBe("license-key-instance");
    expect(findResourceVerb("subscription_items", "current-usage")?.resource).toBe(
      "subscription-item",
    );
  });

  it("marks only delete/cancel/refund as destructive", () => {
    for (const entry of resourceRegistry) {
      if (entry.destructive) {
        expect(["delete", "cancel", "refund"]).toContain(entry.verb);
      }
    }
    expect(findResourceVerb("subscription", "cancel")?.destructive).toBe(true);
    expect(findResourceVerb("order", "refund")?.destructive).toBe(true);
    expect(findResourceVerb("discount", "delete")?.destructive).toBe(true);
    expect(findResourceVerb("webhook", "update")?.destructive).toBeUndefined();
  });

  it("keeps catalog resources free of write verbs", () => {
    for (const resource of READ_ONLY_RESOURCES) {
      for (const verb of ["create", "update", "delete"] as const) {
        expect(findResourceVerb(resource, verb)).toBeUndefined();
      }
    }
  });

  it("has unique resource:verb pairs and listRegisteredVerbs matches", () => {
    const keys = resourceRegistry.map((entry) => `${entry.resource}:${entry.verb}`);
    expect(new Set(keys).size).toBe(keys.length);

    expect(listRegisteredVerbs("webhook")).toEqual(["create", "delete", "get", "list", "update"]);
    expect(listRegisteredVerbs("product")).toEqual(["get", "list"]);
    expect(listRegisteredVerbs("nope")).toEqual([]);
  });

  it("requires bodies for documented creates and optional bodies for refunds", () => {
    expect(findResourceVerb("checkout", "create")?.body).toBe("required");
    expect(findResourceVerb("customer", "create")?.body).toBe("required");
    expect(findResourceVerb("order", "refund")?.body).toBe("optional");
    expect(findResourceVerb("subscription", "cancel")?.body).toBe("none");
    expect(findResourceVerb("user", "get")?.idRole).toBe("none");
  });
});

const fakeHttp = () => {
  const resource = { type: "webhooks", id: "1", attributes: { url: "https://x.test" } };
  return {
    request: vi.fn(async () => ({ data: resource })),
    paginate: vi.fn(async () => [resource]),
  } as unknown as HttpClient & {
    request: ReturnType<typeof vi.fn>;
    paginate: ReturnType<typeof vi.fn>;
  };
};

describe("invokeOp", () => {
  it.each([
    ["product", "get", { id: 42 }, "GET", "/v1/products/42", undefined],
    ["webhook", "create", { body: { a: 1 } }, "POST", "/v1/webhooks", { a: 1 }],
    ["subscription", "update", { id: 3, body: { a: 1 } }, "PATCH", "/v1/subscriptions/3", { a: 1 }],
    [
      "subscription",
      "cancel",
      { id: 3, body: { ignored: true } },
      "DELETE",
      "/v1/subscriptions/3",
      undefined,
    ],
    ["order", "refund", { id: 100 }, "POST", "/v1/orders/100/refund", {}],
    [
      "order",
      "generate-invoice",
      { id: 100, body: { locale: "en" } },
      "POST",
      "/v1/orders/100/generate-invoice",
      { locale: "en" },
    ],
    [
      "subscription-item",
      "current-usage",
      { id: 5 },
      "GET",
      "/v1/subscription-items/5/current-usage",
      undefined,
    ],
    ["webhook", "delete", { id: 12 }, "DELETE", "/v1/webhooks/12", undefined],
  ] as const)("%s %s → %s %s", async (resource, verb, args, method, path, body) => {
    const http = fakeHttp();
    await invokeOp(http, resource, verb, args);
    expect(http.request).toHaveBeenCalledWith({ method, path, body });
  });

  it("lists with the store filter or the parent filter", async () => {
    const http = fakeHttp();
    await invokeOp(http, "product", "list", { storeId: 7 });
    expect(http.paginate).toHaveBeenCalledWith("/v1/products", { "filter[store_id]": "7" });

    await invokeOp(http, "usage-record", "list", { parentId: 9 });
    expect(http.paginate).toHaveBeenCalledWith("/v1/usage-records", {
      "filter[subscription_item_id]": "9",
    });

    await invokeOp(http, "stores", "list", { storeId: 7 });
    expect(http.paginate).toHaveBeenCalledWith("/v1/stores", undefined);
  });

  it("returns data, the whole document when there is no data, and nothing after a 204", async () => {
    const http = fakeHttp();
    expect(await invokeOp(http, "product", "get", { id: 1 })).toMatchObject({ id: "1" });

    http.request.mockResolvedValueOnce({ meta: { urls: { download_invoice_url: "https://x" } } });
    expect(await invokeOp(http, "order", "generate-invoice", { id: 1 })).toEqual({
      meta: { urls: { download_invoice_url: "https://x" } },
    });

    http.request.mockResolvedValueOnce(undefined);
    expect(await invokeOp(http, "webhook", "delete", { id: 1 })).toBeUndefined();
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
      message: "--id is required for this product operation.",
    });
    await expect(invokeOp(http, "product", "list", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
    });
    await expect(invokeOp(http, "variant", "list", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
      message: "--parent-id (product id) is required for this list operation.",
    });
    await expect(invokeOp(http, "webhook", "create", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
    });
    await expect(invokeOp(http, "product", "get", {})).rejects.toBeInstanceOf(FreshSqueezyError);
  });
});
