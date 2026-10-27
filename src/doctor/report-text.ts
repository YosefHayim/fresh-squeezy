import { styleText } from "node:util";
import type {
	DoctorReport,
	Finding,
	ValidationResult,
	ValidationTarget,
} from "./findings.js";

const SEVERITY_LABELS = {
	error: "✗ error",
	warning: "! warn ",
	info: "i info ",
} as const;

const SEVERITY_COLORS = {
	error: "red",
	warning: "yellow",
	info: "blue",
} as const;

const targetTextOf = (target?: ValidationTarget) => {
	const isTargetMissing = !target;
	if (isTargetMissing) return "";
	const parts = [target.label];
	const isIdGiven = Boolean(target.id);
	if (isIdGiven) parts.push(`id ${target.id}`);
	const isUrlNew = Boolean(target.url) && target.url !== target.label;
	const urlText = String(target.url);
	if (isUrlNew) parts.push(urlText);
	return parts.join(" - ");
};

const findingLinesOf = (finding: Finding) => {
	const label = SEVERITY_LABELS[finding.severity];
	const color = SEVERITY_COLORS[finding.severity];
	const severity = styleText(color, label);
	const code = styleText("gray", `[${finding.code}]`);
	const lines = [`  ${severity} ${code} ${finding.message}`];
	const isFixGiven = Boolean(finding.suggestedFix);
	const fixLabel = styleText("dim", "fix:");
	if (isFixGiven) lines.push(`    ${fixLabel} ${finding.suggestedFix}`);
	return lines;
};

const checkTextOf = (check: ValidationResult) => {
	const isCheckOk = check.ok;
	const badge = isCheckOk
		? styleText("green", "PASS")
		: styleText("red", "FAIL");
	const mode = styleText("dim", `[${check.mode}]`);
	const name = styleText("bold", check.name);
	const target = targetTextOf(check.target);
	const isTargetShown = target !== "";
	const suffix = isTargetShown ? ` ${styleText("dim", target)}` : "";
	const findingLines = check.findings.flatMap(findingLinesOf);
	return [`${badge} ${mode} ${name}${suffix}`, ...findingLines].join("\n");
};

export const reportTextOf = (report: DoctorReport) => {
	const isReportOk = report.ok;
	const header = isReportOk
		? styleText(["green", "bold"], "fresh-squeezy doctor: OK")
		: styleText(["red", "bold"], "fresh-squeezy doctor: FAILED");
	const total = report.results.length;
	const failedCount = report.results.filter((check) => !check.ok).length;
	const isEveryCheckPassing = failedCount === 0;
	const summary = isEveryCheckPassing
		? `${total} checks passed`
		: `${failedCount}/${total} checks failed`;
	const checksText = report.results.map(checkTextOf).join("\n\n");
	const modeText = styleText("dim", `(mode: ${report.mode})`);
	const summaryText = styleText("dim", summary);
	return `${header} ${modeText}\n${summaryText}\n\n${checksText}`;
};
