import { describe, expect, test } from "vitest";
import { describeReport } from "./describe-report.js";
import type { CheckReport, DoctorReport } from "./findings.js";

const createReport = (checks: CheckReport[]): DoctorReport => ({
	ok: checks.every((check) => check.ok),
	mode: "test",
	checks,
});

const PASSING_CHECK: CheckReport = {
	name: "connection",
	ok: true,
	mode: "test",
	findings: [],
};

const FAILING_CHECK: CheckReport = {
	name: "discount",
	ok: false,
	mode: "test",
	findings: [
		{
			code: "DISCOUNT_EXPIRED",
			severity: "error",
			message: "Discount expired.",
		},
	],
};

describe("describeReport", () => {
	test("shows the OK header, the mode and the passed count", () => {
		const report = createReport([PASSING_CHECK, PASSING_CHECK]);

		const description = describeReport(report);

		expect(description).toContain("fresh-squeezy doctor: OK");
		expect(description).toContain("(mode: test)");
		expect(description).toContain("2 checks passed");
		expect(description).not.toContain("FAILED");
	});

	test("shows the FAILED header and how many checks failed", () => {
		const report = createReport([PASSING_CHECK, FAILING_CHECK]);

		const description = describeReport(report);

		expect(description).toContain("fresh-squeezy doctor: FAILED");
		expect(description).toContain("1/2 checks failed");
	});

	test("shows PASS and FAIL badges with the mode and check name", () => {
		const report = createReport([PASSING_CHECK, FAILING_CHECK]);

		const description = describeReport(report);

		expect(description).toContain("PASS [test] connection");
		expect(description).toContain("FAIL [test] discount");
	});

	test("shows a check without a target as just its name", () => {
		const report = createReport([PASSING_CHECK]);

		const description = describeReport(report);

		expect(description.endsWith("PASS [test] connection")).toBe(true);
		expect(description).not.toContain(" - ");
	});

	test("shows the target label alone when it has no id and no url", () => {
		const check: CheckReport = {
			...PASSING_CHECK,
			target: { label: "my store" },
		};

		const description = describeReport(createReport([check]));

		expect(description).toContain("connection my store");
		expect(description).not.toContain(" - ");
	});

	test("shows the target label, id and url joined by dashes", () => {
		const check: CheckReport = {
			...PASSING_CHECK,
			target: {
				label: "SUMMER (SUMMER20)",
				id: "600",
				url: "https://example.com/d",
			},
		};

		const description = describeReport(createReport([check]));

		expect(description).toContain(
			"connection SUMMER (SUMMER20) - id 600 - https://example.com/d",
		);
	});

	test("hides the target url when it equals the label", () => {
		const check: CheckReport = {
			...PASSING_CHECK,
			target: {
				label: "https://example.com/hook",
				url: "https://example.com/hook",
			},
		};

		const description = describeReport(createReport([check]));

		expect(description.endsWith("connection https://example.com/hook")).toBe(
			true,
		);
		expect(description).not.toContain(" - ");
	});

	test("shows each finding with its severity, code and message", () => {
		const check: CheckReport = {
			...FAILING_CHECK,
			findings: [
				{ code: "DISCOUNT_EXPIRED", severity: "error", message: "Expired." },
				{ code: "DISCOUNT_DRAFT", severity: "warning", message: "Careful." },
				{ code: "UNKNOWN", severity: "info", message: "FYI." },
			],
		};

		const description = describeReport(createReport([check]));

		expect(description).toContain("✗ error [DISCOUNT_EXPIRED] Expired.");
		expect(description).toContain("! warn  [DISCOUNT_DRAFT] Careful.");
		expect(description).toContain("i info  [UNKNOWN] FYI.");
	});

	test("shows the suggested fix only when a finding has one", () => {
		const check: CheckReport = {
			...FAILING_CHECK,
			findings: [
				{
					code: "DISCOUNT_EXPIRED",
					severity: "error",
					message: "Expired.",
					suggestedFix: "Extend it.",
				},
				{ code: "UNKNOWN", severity: "error", message: "No fix here." },
			],
		};

		const description = describeReport(createReport([check]));

		expect(description).toContain("fix: Extend it.");
		expect(description.split("fix:")).toHaveLength(2);
	});
});
