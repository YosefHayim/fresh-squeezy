import { describe, expect, test } from "vitest";
import {
	createCheckReport,
	type Finding,
	type FindingRule,
	raiseFindings,
} from "./findings.js";

const isNegative = (amount: number) => amount < 0;
const isZero = (amount: number) => amount === 0;

const AMOUNT_RULES: FindingRule<number>[] = [
	{
		code: "UNKNOWN",
		severity: "error",
		when: isNegative,
		message: (amount) => `${amount} is negative.`,
		suggestedFix: (amount) => `Replace ${amount} with a positive number.`,
		context: (amount) => ({ amount }),
	},
	{
		code: "UNKNOWN",
		severity: "warning",
		when: isZero,
		message: "Zero.",
		suggestedFix: "Use a positive number.",
	},
];

const ERROR_FINDING: Finding = {
	code: "UNKNOWN",
	severity: "error",
	message: "bad",
};
const WARNING_FINDING: Finding = {
	code: "UNKNOWN",
	severity: "warning",
	message: "meh",
};

describe("raiseFindings", () => {
	test("returns only the rules that apply, with computed text", () => {
		const findings = raiseFindings(AMOUNT_RULES, -3);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toBe("-3 is negative.");
		expect(findings[0]?.suggestedFix).toBe(
			"Replace -3 with a positive number.",
		);
		expect(findings[0]?.context).toEqual({ amount: -3 });
	});

	test("keeps plain text and leaves the context empty when the rule has none", () => {
		const [finding] = raiseFindings(AMOUNT_RULES, 0);

		expect(finding?.message).toBe("Zero.");
		expect(finding?.suggestedFix).toBe("Use a positive number.");
		expect(finding?.context).toBeUndefined();
	});

	test("leaves the fix empty when the rule has none", () => {
		const rulesWithoutFix: FindingRule<number>[] = [
			{ code: "UNKNOWN", severity: "info", when: isZero, message: "Zero." },
		];

		const [finding] = raiseFindings(rulesWithoutFix, 0);

		expect(finding?.suggestedFix).toBeUndefined();
	});

	test("returns nothing when no rule applies", () => {
		const findings = raiseFindings(AMOUNT_RULES, 5);

		expect(findings).toEqual([]);
	});
});

describe("createCheckReport", () => {
	test("is ok with warnings only", () => {
		const report = createCheckReport({
			name: "store",
			mode: "test",
			findings: [WARNING_FINDING],
		});

		expect(report.ok).toBe(true);
	});

	test("is ok with no findings", () => {
		const report = createCheckReport({
			name: "store",
			mode: "test",
			findings: [],
		});

		expect(report.ok).toBe(true);
	});

	test("is not ok with an error finding and keeps its fields in order", () => {
		const report = createCheckReport({
			name: "store",
			mode: "live",
			findings: [WARNING_FINDING, ERROR_FINDING],
			resource: { id: 1 },
			target: { label: "store 1", id: "1" },
		});

		expect(report.ok).toBe(false);
		expect(Object.keys(report)).toEqual([
			"name",
			"ok",
			"mode",
			"findings",
			"resource",
			"target",
		]);
	});
});
