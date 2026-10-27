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

const formatTarget = (target?: CheckTarget) => {
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

const formatFinding = (finding: Finding) => {
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

const formatCheck = (check: CheckReport) => {
	const isCheckOk = check.ok;
	const badge = isCheckOk
		? styleText("green", "PASS")
		: styleText("red", "FAIL");
	const mode = styleText("dim", `[${check.mode}]`);
	const name = styleText("bold", check.name);
	const target = formatTarget(check.target);
	const isTargetShown = target !== "";
	const suffix = isTargetShown ? ` ${styleText("dim", target)}` : "";
	const findingLines = check.findings.flatMap(formatFinding);
	return [`${badge} ${mode} ${name}${suffix}`, ...findingLines].join("\n");
};

export const formatReport = (report: DoctorReport) => {
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
	const checksText = report.checks.map(formatCheck).join("\n\n");
	const modeText = styleText("dim", `(mode: ${report.mode})`);
	const summaryText = styleText("dim", summary);
	return `${header} ${modeText}\n${summaryText}\n\n${checksText}`;
};
