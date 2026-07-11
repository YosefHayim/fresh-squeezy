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
    request: vi.fn(async () => ({ data: resource })),
  } as unknown as HttpClient & {
    getResource: ReturnType<typeof vi.fn>;
    postResource: ReturnType<typeof vi.fn>;
    deleteResource: ReturnType<typeof vi.fn>;
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

  it("rejects unknown ops and missing ids with FreshSqueezyError", async () => {
    const http = fakeHttp();
    await expect(invokeOp(http, "product", "create", {})).rejects.toBeInstanceOf(FreshSqueezyError);
    await expect(invokeOp(http, "product", "get", {})).rejects.toMatchObject({
      code: "MISSING_ARG",
    });
  });
});
