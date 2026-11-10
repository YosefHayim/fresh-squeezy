import { styleText } from "node:util";
import type {
	CheckReport,
	CheckTarget,
	DoctorReport,
	Finding,
} from "./findings.js";

const pickTargetSuffix = (target: CheckTarget | null) => {
	const isTargetMissing = target == null;
	if (isTargetMissing) return "";

	const { label, id, url } = target;
	const parts = [label];
	const isIdGiven = id != null;
	if (isIdGiven) parts.push(`id ${id}`);

	const isUrlNew = url != null && url !== label;
	if (isUrlNew) parts.push(url);

	return ` ${styleText("dim", parts.join(" - "))}`;
};

const describeFinding = (finding: Finding) => {
	const label = {
		error: "✗ error",
		warning: "! warn ",
		info: "i info ",
	}[finding.severity];
	const severityColors = {
		error: "red",
		warning: "yellow",
		info: "blue",
	} as const;
	const severity = styleText(severityColors[finding.severity], label);

	const code = styleText("gray", `[${finding.code}]`);
	const lines = [`  ${severity} ${code} ${finding.message}`];

	const isFixGiven = finding.suggestedFix != null;
	const fixLabel = styleText("dim", "fix:");
	if (isFixGiven) lines.push(`    ${fixLabel} ${finding.suggestedFix}`);

	return lines;
};

const pickCheckBadge = (check: CheckReport) => {
	const isCheckOk = check.ok;
	if (isCheckOk) return styleText("green", "PASS");

	return styleText("red", "FAIL");
};

const describeCheck = (check: CheckReport) => {
	const badge = pickCheckBadge(check);
	const mode = styleText("dim", `[${check.mode}]`);
	const name = styleText("bold", check.name);
	const suffix = pickTargetSuffix(check.target);

	const findingLines = check.findings.flatMap(describeFinding);
	return [`${badge} ${mode} ${name}${suffix}`, ...findingLines].join("\n");
};

const pickReportHeader = (report: DoctorReport) => {
	const isReportOk = report.ok;
	if (isReportOk) {
		return styleText(["green", "bold"], "fresh-squeezy doctor: OK");
	}

	return styleText(["red", "bold"], "fresh-squeezy doctor: FAILED");
};

const pickReportSummary = (report: DoctorReport) => {
	const total = report.checks.length;
	const failedCount = report.checks.filter((check) => !check.ok).length;

	const isEveryCheckPassing = failedCount === 0;
	if (isEveryCheckPassing) return `${total} checks passed`;

	return `${failedCount}/${total} checks failed`;
};

export const describeReport = (report: DoctorReport) => {
	const header = pickReportHeader(report);
	const summary = pickReportSummary(report);

	const checkLines = report.checks.map(describeCheck).join("\n\n");
	const modeLabel = styleText("dim", `(mode: ${report.mode})`);
	const summaryLabel = styleText("dim", summary);
	return `${header} ${modeLabel}\n${summaryLabel}\n\n${checkLines}`;
};
