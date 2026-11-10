import { describe, expect, test } from "vitest";
import { isExpired } from "./is-expired.js";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("isExpired", () => {
	test("returns false when there is no expiry date", () => {
		const isExpiredNow = isExpired(null, NOW);

		expect(isExpiredNow).toBe(false);
	});

	test("returns true when the expiry date is before now", () => {
		const isExpiredNow = isExpired("2026-05-31T23:59:59Z", NOW);

		expect(isExpiredNow).toBe(true);
	});

	test("returns false when the expiry date is after now", () => {
		const isExpiredNow = isExpired("2026-06-01T00:00:01Z", NOW);

		expect(isExpiredNow).toBe(false);
	});
});
