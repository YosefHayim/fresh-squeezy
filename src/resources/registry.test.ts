import { describe, expect, it } from "vitest";
import { findResourceVerb, listRegisteredResources, resourceRegistry } from "./registry.js";

describe("resourceRegistry", () => {
  it("includes docs-backed webhook CRUD and excludes product create", () => {
    expect(findResourceVerb("webhook", "create")?.docsPath).toBe("webhooks/create-webhook");
    expect(findResourceVerb("webhook", "delete")?.destructive).toBe(true);
    expect(findResourceVerb("product", "get")).toBeDefined();
    expect(findResourceVerb("product", "create")).toBeUndefined();
    expect(findResourceVerb("products", "list")?.resource).toBe("product");
  });

  it("lists unique resources and only known verbs", () => {
    const resources = listRegisteredResources();
    expect(resources).toContain("webhook");
    expect(resources).toContain("product");
    expect(resourceRegistry.every((entry) => entry.docsPath.length > 0)).toBe(true);
  });
});
