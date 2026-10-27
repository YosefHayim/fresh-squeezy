import { describe, expect, test } from "vitest";
import {
	createFreshSqueezyError,
	isFreshSqueezyError,
} from "@/client/errors.js";

describe("createFreshSqueezyError", () => {
	test("returns a real Error carrying code, status and detail", () => {
		const detail = { id: 1 };

		const error = createFreshSqueezyError({
			code: "NOT_FOUND",
			message: "missing",
			status: 404,
			detail,
		});

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("FreshSqueezyError");
		expect(error.message).toBe("missing");
		expect(error.code).toBe("NOT_FOUND");
		expect(error.status).toBe(404);
		expect(error.detail).toEqual(detail);
		expect(error.stack).toContain("missing");
	});

	test("leaves status and detail undefined when omitted", () => {
		const error = createFreshSqueezyError({ code: "UNKNOWN", message: "m" });

		expect(error.status).toBeUndefined();
		expect(error.detail).toBeUndefined();
	});
});

describe("isFreshSqueezyError", () => {
	test("is true for an error made by createFreshSqueezyError", () => {
		const error = createFreshSqueezyError({ code: "UNKNOWN", message: "m" });

		const isFreshSqueezy = isFreshSqueezyError(error);

		expect(isFreshSqueezy).toBe(true);
	});

	test("is false for a plain Error, a string and null", () => {
		const plainError = new Error("boom");

		expect(isFreshSqueezyError(plainError)).toBe(false);
		expect(isFreshSqueezyError("FreshSqueezyError")).toBe(false);
		expect(isFreshSqueezyError(null)).toBe(false);
	});

	test("is false for an Error named like ours but without a code", () => {
		const lookalikeError = new Error("boom");
		lookalikeError.name = "FreshSqueezyError";

		const isFreshSqueezy = isFreshSqueezyError(lookalikeError);

		expect(isFreshSqueezy).toBe(false);
	});
});
