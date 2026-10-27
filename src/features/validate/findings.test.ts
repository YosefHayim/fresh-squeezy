import { expect, test } from "vitest";
import {
	buildResult,
	type Finding,
	type FindingRule,
	findingsFrom,
} from "./findings.js";

const isNegative = (value: number) => value < 0;
const isZero = (value: number) => value === 0;

const NUMBER_RULES: FindingRule<number>[] = [
	{
		code: "UNKNOWN",
		severity: "error",
		when: isNegative,
		message: (value) => `${value} is negative.`,
		suggestedFix: "Use a positive number.",
		context: (value) => ({ value }),
	},
	{ code: "UNKNOWN", severity: "warning", when: isZero, message: "Zero." },
];

const errorFinding: Finding = {
	code: "UNKNOWN",
	severity: "error",
	message: "bad",
};
const warningFinding: Finding = {
	code: "UNKNOWN",
	severity: "warning",
	message: "meh",
};

test("findingsFrom returns only the rules that apply, with computed text", () => {
	const findings = findingsFrom(NUMBER_RULES, -3);

	expect(findings).toHaveLength(1);
	expect(findings[0]?.message).toBe("-3 is negative.");
	expect(findings[0]?.suggestedFix).toBe("Use a positive number.");
	expect(findings[0]?.context).toEqual({ value: -3 });
});

test("findingsFrom keeps plain text and leaves the fix empty when the rule has none", () => {
	const [finding] = findingsFrom(NUMBER_RULES, 0);

	expect(finding?.message).toBe("Zero.");
	expect(finding?.suggestedFix).toBeUndefined();
});

test("findingsFrom returns nothing when no rule applies", () => {
	expect(findingsFrom(NUMBER_RULES, 5)).toEqual([]);
});

test("buildResult is ok with warnings only", () => {
	const validation = buildResult({
		name: "store",
		mode: "test",
		findings: [warningFinding],
	});

	expect(validation.ok).toBe(true);
});

test("buildResult is not ok with an error finding", () => {
	const validation = buildResult({
		name: "store",
		mode: "live",
		findings: [warningFinding, errorFinding],
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
