import { describe, expect, it } from "vitest";
import {
  type OpVerb,
  findResourceVerb,
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
