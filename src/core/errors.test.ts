import { describe, expect, it } from "vitest";
import { freshSqueezyErrorOf, isFreshSqueezyError } from "./errors.js";

describe("freshSqueezyErrorOf", () => {
  it("returns a real Error carrying code, status and detail", () => {
    const error = freshSqueezyErrorOf({
      code: "NOT_FOUND",
      message: "missing",
      status: 404,
      detail: { id: 1 },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("FreshSqueezyError");
    expect(error.message).toBe("missing");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.detail).toEqual({ id: 1 });
    expect(error.stack).toContain("missing");
  });

  it("leaves status and detail undefined when omitted", () => {
    const error = freshSqueezyErrorOf({ code: "X", message: "m" });
    expect(error.status).toBeUndefined();
    expect(error.detail).toBeUndefined();
  });
});

describe("isFreshSqueezyError", () => {
  it("is true for an error made by the factory", () => {
    expect(isFreshSqueezyError(freshSqueezyErrorOf({ code: "X", message: "m" }))).toBe(true);
  });

  it("is false for a plain Error, a string and null", () => {
    expect(isFreshSqueezyError(new Error("boom"))).toBe(false);
    expect(isFreshSqueezyError("FreshSqueezyError")).toBe(false);
    expect(isFreshSqueezyError(null)).toBe(false);
  });
});
