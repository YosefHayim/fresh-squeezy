import { expect, test } from "vitest";
import {
	buildCheckReport,
	type Finding,
	type FindingRule,
	raiseFindings,
} from "./findings.js";

const isNegative = (amount: number) => amount < 0;
const isZero = (amount: number) => amount === 0;

const NUMBER_RULES: FindingRule<number>[] = [
	{
		code: "UNKNOWN",
		severity: "error",
		when: isNegative,
		message: (amount) => `${amount} is negative.`,
		suggestedFix: "Use a positive number.",
		context: (amount) => ({ amount }),
	},
	{ code: "UNKNOWN", severity: "warning", when: isZero, message: "Zero." },
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

test("raiseFindings returns only the rules that apply, with computed text", () => {
	const findings = raiseFindings(NUMBER_RULES, -3);

	expect(findings).toHaveLength(1);
	expect(findings[0]?.message).toBe("-3 is negative.");
	expect(findings[0]?.suggestedFix).toBe("Use a positive number.");
	expect(findings[0]?.context).toEqual({ amount: -3 });
});

test("raiseFindings keeps plain text and leaves the fix empty when the rule has none", () => {
	const [finding] = raiseFindings(NUMBER_RULES, 0);

	expect(finding?.message).toBe("Zero.");
	expect(finding?.suggestedFix).toBeUndefined();
});

test("raiseFindings returns nothing when no rule applies", () => {
	expect(raiseFindings(NUMBER_RULES, 5)).toEqual([]);
});

test("buildCheckReport is ok with warnings only", () => {
	const validation = buildCheckReport({
		name: "store",
		mode: "test",
		findings: [WARNING_FINDING],
	});

	expect(validation.ok).toBe(true);
});

test("buildCheckReport is not ok with an error finding", () => {
	const validation = buildCheckReport({
		name: "store",
		mode: "live",
		findings: [WARNING_FINDING, ERROR_FINDING],
		resource: { id: 1 },
		target: { label: "store 1", id: "1" },
	});

	expect(validation.ok).toBe(false);
	expect(Object.keys(validation)).toEqual([
		"name",
		"ok",
		"mode",
		"findings",
		"resource",
		"target",
	]);
});
