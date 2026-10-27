import { expect, test, vi } from "vitest";
import type { DoctorReport } from "./features/validate/findings.js";
import { reportTextOf } from "./print-report.js";

vi.stubEnv("NO_COLOR", "1");

const passingReport: DoctorReport = {
	ok: true,
	mode: "test",
	results: [
		{
			name: "connection",
			ok: true,
			mode: "test",
			findings: [],
			target: { label: "connection" },
		},
	],
};

const failingReport: DoctorReport = {
	ok: false,
	mode: "live",
	results: [
		{ name: "connection", ok: true, mode: "live", findings: [] },
		{
			name: "discount",
			ok: false,
			mode: "live",
			findings: [
				{
					code: "DISCOUNT_EXPIRED",
					severity: "error",
					message: "Discount expired.",
					suggestedFix: "Extend it.",
				},
				{ code: "UNKNOWN", severity: "warning", message: "Careful." },
				{ code: "UNKNOWN", severity: "info", message: "FYI." },
			],
			target: {
				label: "SUMMER (SUMMER20)",
				id: "600",
				url: "https://example.com/d",
			},
		},
	],
};

test("reportTextOf prints the pass summary and the check line", () => {
	const text = reportTextOf(passingReport);

	expect(text).toContain("fresh-squeezy doctor: OK");
	expect(text).toContain("(mode: test)");
	expect(text).toContain("1 checks passed");
	expect(text).toContain("PASS [test] connection");
});

test("reportTextOf prints failed checks with findings, fixes and the target", () => {
	const text = reportTextOf(failingReport);

	expect(text).toContain("fresh-squeezy doctor: FAILED");
	expect(text).toContain("1/2 checks failed");
	expect(text).toContain(
		"FAIL [live] discount SUMMER (SUMMER20) - id 600 - https://example.com/d",
	);
	expect(text).toContain("[DISCOUNT_EXPIRED] Discount expired.");
	expect(text).toContain("fix: Extend it.");
	expect(text).toContain("! warn");
	expect(text).toContain("i info");
});
