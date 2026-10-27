import { styleText } from "node:util";
import type {
	CheckReport,
	CheckTarget,
	DoctorReport,
	Finding,
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

const describeTarget = (target?: CheckTarget) => {
	const isTargetMissing = !target;
	if (isTargetMissing) return "";
	const parts = [target.label];
	const isIdGiven = Boolean(target.id);
	if (isIdGiven) parts.push(`id ${target.id}`);
	const isUrlNew = Boolean(target.url) && target.url !== target.label;
	if (isUrlNew) parts.push(String(target.url));
	return parts.join(" - ");
};

const describeFinding = (finding: Finding) => {
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

const describeCheck = (check: CheckReport) => {
	const isCheckOk = check.ok;
	const badge = isCheckOk
		? styleText("green", "PASS")
		: styleText("red", "FAIL");
	const mode = styleText("dim", `[${check.mode}]`);
	const name = styleText("bold", check.name);
	const target = describeTarget(check.target);
	const isTargetShown = target !== "";
	const suffix = isTargetShown ? ` ${styleText("dim", target)}` : "";
	const findingLines = check.findings.flatMap(describeFinding);
	return [`${badge} ${mode} ${name}${suffix}`, ...findingLines].join("\n");
};

export const describeReport = (report: DoctorReport) => {
	const isReportOk = report.ok;
	const header = isReportOk
		? styleText(["green", "bold"], "fresh-squeezy doctor: OK")
		: styleText(["red", "bold"], "fresh-squeezy doctor: FAILED");
	const total = report.checks.length;
	const failedCount = report.checks.filter((check) => !check.ok).length;
	const isEveryCheckPassing = failedCount === 0;
	const summary = isEveryCheckPassing
		? `${total} checks passed`
		: `${failedCount}/${total} checks failed`;
	const checkLines = report.checks.map(describeCheck).join("\n\n");
	const modeLabel = styleText("dim", `(mode: ${report.mode})`);
	const summaryLabel = styleText("dim", summary);
	return `${header} ${modeLabel}\n${summaryLabel}\n\n${checkLines}`;
};
