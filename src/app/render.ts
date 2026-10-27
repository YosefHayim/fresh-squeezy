import chalk from "chalk";
import { ENV_KEYS } from "@/shared/config.js";
import type {
	DoctorReport,
	ValidationIssue,
	ValidationResult,
	ValidationTarget,
} from "@/shared/contracts.js";
import { isFreshSqueezyError } from "@/shared/errors.js";

export const MISSING_API_KEY_HINTS = [
	"fresh-squeezy init",
	`export ${ENV_KEYS.apiKey}=ls_live_or_test_key`,
];

const brand = chalk.green.bold("fresh-squeezy");
const divider = chalk.dim("•");

export const renderBrandHeader = (title: string, subtitle?: string): string => {
	const lines = [`${brand} ${divider} ${chalk.bold(title)}`];
	const isThereSubtitle = Boolean(subtitle);
	if (isThereSubtitle) {
		const dimSubtitle = chalk.dim(subtitle);
		lines.push(dimSubtitle);
	}
	lines.push("");
	return lines.join("\n");
};

export const renderStep = (
	index: number,
	total: number,
	title: string,
	detail?: string,
): string => {
	const isThereDetail = Boolean(detail);
	const isNotFirstStep = index > 1;
	const suffix = isThereDetail ? ` ${chalk.dim(detail)}` : "";
	const prefix = isNotFirstStep ? "\n" : "";
	return `${prefix}${chalk.yellow("●")} ${chalk.dim(`${index}/${total}`)} ${chalk.bold(title)}${suffix}\n`;
};

export const renderDetected = (
	label: string,
	value: string,
	source?: string,
): string => {
	const isThereSource = Boolean(source);
	const suffix = isThereSource ? ` ${chalk.dim(`from ${source}`)}` : "";
	return `  ${chalk.green("✓")} ${chalk.bold(label)} ${value}${suffix}\n`;
};

export const renderCommandExamples = (): string => {
	return [
		renderBrandHeader(
			"Command examples",
			"Direct commands stay stable for scripts and CI.",
		),
		`${chalk.bold("Guided setup")}`,
		"  fresh-squeezy init",
		"",
		`${chalk.bold("Full doctor")}`,
		"  fresh-squeezy doctor --all-stores",
		"  fresh-squeezy doctor --store-ids 12 --product-id 987 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy",
		"",
		`${chalk.bold("Single checks")}`,
		"  fresh-squeezy validate connection",
		"  fresh-squeezy validate webhook --store-ids 12 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy",
		"",
		`${chalk.bold("Bulk ops (delete / cancel / refund)")}`,
		"  fresh-squeezy delete discount --all --store-ids 12 --dry-run",
		"  fresh-squeezy delete discount --all --store-ids 12 --match TEST --yes",
		"  fresh-squeezy delete webhook --ids 1,2,3 --yes",
		"",
		`${chalk.bold("Automation")}`,
		"  fresh-squeezy doctor --all-stores --json",
		"",
	].join("\n");
};

export const renderCancelMessage = (): string => {
	return `${chalk.dim("fresh-squeezy cancelled.")}\n`;
};

export const renderResult = (validation: ValidationResult): string => {
	const lines: string[] = [];
	const badge = validation.ok ? chalk.green("PASS") : chalk.red("FAIL");
	const mode = chalk.dim(`[${validation.mode}]`);
	const target = renderTarget(validation.target);
	const isThereTarget = target !== "";
	const suffix = isThereTarget ? ` ${chalk.dim(target)}` : "";
	lines.push(`${badge} ${mode} ${chalk.bold(validation.name)}${suffix}`);

	for (const issue of validation.issues) {
		const issueLine = renderIssueLine(issue);
		lines.push(`  ${issueLine}`);
		const isThereSuggestedFix = Boolean(issue.suggestedFix);
		if (isThereSuggestedFix) {
			lines.push(`    ${chalk.dim("fix:")} ${issue.suggestedFix}`);
		}
	}

	return lines.join("\n");
};

const renderTarget = (target: ValidationTarget | undefined): string => {
	const isThereNoTarget = !target;
	if (isThereNoTarget) return "";
	const parts = [target.label];
	const isThereTargetId = Boolean(target.id);
	if (isThereTargetId) parts.push(`id ${target.id}`);
	const isTargetUrlNew = Boolean(target.url) && target.url !== target.label;
	if (isTargetUrlNew) parts.push(target.url as string);
	return parts.join(" - ");
};

export const renderReport = (report: DoctorReport): string => {
	const header = report.ok
		? chalk.green.bold("fresh-squeezy doctor: OK")
		: chalk.red.bold("fresh-squeezy doctor: FAILED");
	const failed = report.results.filter((validation) => !validation.ok).length;
	const areAllChecksPassing = failed === 0;
	const summary = areAllChecksPassing
		? chalk.dim(`${report.results.length} checks passed`)
		: chalk.dim(`${failed}/${report.results.length} checks failed`);
	const body = report.results.map(renderResult).join("\n\n");
	return `${header} ${chalk.dim(`(mode: ${report.mode})`)}\n${summary}\n\n${body}`;
};

const renderIssueLine = (issue: ValidationIssue): string => {
	const errorLabel = chalk.red("✗ error");
	const warningLabel = chalk.yellow("! warn ");
	const infoLabel = chalk.blue("i info ");
	const isError = issue.severity === "error";
	const isWarning = issue.severity === "warning";
	const severityLabel = isWarning ? warningLabel : infoLabel;
	const label = isError ? errorLabel : severityLabel;
	const issueCode = chalk.gray(`[${issue.code}]`);
	return `${label} ${issueCode} ${issue.message}`;
};

export const renderCliError = (
	message: string,
	hints: string[] = [],
): string => {
	const lines = [`fresh-squeezy: ${message}`];

	const areThereHints = hints.length > 0;
	if (areThereHints) {
		lines.push("", "Try:");
		for (const hint of hints) {
			lines.push(`  ${hint}`);
		}
	}

	return `${lines.join("\n")}\n`;
};

export const getDoctorHints = (err: unknown): string[] => {
	const isNotFreshSqueezyError = !isFreshSqueezyError(err);
	if (isNotFreshSqueezyError) return [];

	const isApiKeyMissing = err.code === "MISSING_API_KEY";
	const isModeInvalid = err.code === "INVALID_MODE";
	const areStoresMissing = err.code === "NO_STORES";

	if (isApiKeyMissing) {
		return MISSING_API_KEY_HINTS;
	}

	if (isModeInvalid) {
		return [
			"fresh-squeezy doctor --mode test",
			"fresh-squeezy doctor --mode live",
		];
	}

	if (areStoresMissing) {
		return [
			"Check that the API key belongs to an account with a Lemon Squeezy store.",
		];
	}

	return [];
};
