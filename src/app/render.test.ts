import { expect, test } from "vitest";
import type { DoctorReport, ValidationResult } from "@/shared/contracts.js";
import { renderReport, renderResult, renderStep } from "./render.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI SGR escape sequences from CLI output
const stripAnsi = (value: string): string => value.replace(/\[[0-9;]*m/g, "");

test("renderResult marks a clean validation as PASS", () => {
	const validation: ValidationResult = {
		name: "connection",
		ok: true,
		mode: "test",
		issues: [],
	};
	expect(stripAnsi(renderResult(validation))).toContain(
		"PASS [test] connection",
	);
});

test("renderResult prints the checked resource target when one is available", () => {
	const validation: ValidationResult = {
		name: "product",
		ok: true,
		mode: "test",
		target: { label: "Pro Plan", id: "100" },
		issues: [],
	};
	expect(stripAnsi(renderResult(validation))).toContain(
		"PASS [test] product Pro Plan - id 100",
	);
});

test("renderResult marks a failing validation as FAIL and lists issues with codes", () => {
	const validation: ValidationResult = {
		name: "store",
		ok: false,
		mode: "live",
		issues: [
			{
				code: "STORE_NOT_FOUND",
				severity: "error",
				message: "nope",
				suggestedFix: "double-check the id",
			},
		],
	};
	const text = stripAnsi(renderResult(validation));
	expect(text).toContain("FAIL [live] store");
	expect(text).toContain("[STORE_NOT_FOUND]");
	expect(text).toContain("fix: double-check the id");
});

test("renderReport includes the overall header and all results", () => {
	const report: DoctorReport = {
		ok: false,
		mode: "test",
		results: [
			{ name: "connection", ok: true, mode: "test", issues: [] },
			{
				name: "store",
				ok: false,
				mode: "test",
				issues: [
					{ code: "STORE_NOT_FOUND", severity: "error", message: "nope" },
				],
			},
		],
	};
	const text = stripAnsi(renderReport(report));
	expect(text).toContain("fresh-squeezy doctor: FAILED");
	expect(text).toContain("1/2 checks failed");
	expect(text).toContain("PASS [test] connection");
	expect(text).toContain("FAIL [test] store");
});

test("renderStep keeps the first step tight and separates later steps with a blank line", () => {
	expect(stripAnsi(renderStep(1, 5, "Credentials"))).toBe(
		"● 1/5 Credentials\n",
	);
	expect(stripAnsi(renderStep(2, 5, "Account probe"))).toBe(
		"\n● 2/5 Account probe\n",
	);
});
