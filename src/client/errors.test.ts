import { expect, test } from "vitest";
import { freshSqueezyErrorOf, isFreshSqueezyError } from "@/client/errors.js";

test("freshSqueezyErrorOf returns a real Error carrying code, status and detail", () => {
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

test("freshSqueezyErrorOf leaves status and detail undefined when omitted", () => {
	const error = freshSqueezyErrorOf({ code: "X", message: "m" });
	expect(error.status).toBeUndefined();
	expect(error.detail).toBeUndefined();
});

test("isFreshSqueezyError is true for an error made by the factory", () => {
	expect(
		isFreshSqueezyError(freshSqueezyErrorOf({ code: "X", message: "m" })),
	).toBe(true);
});

test("isFreshSqueezyError is false for a plain Error, a string and null", () => {
	expect(isFreshSqueezyError(new Error("boom"))).toBe(false);
	expect(isFreshSqueezyError("FreshSqueezyError")).toBe(false);
	expect(isFreshSqueezyError(null)).toBe(false);
});
