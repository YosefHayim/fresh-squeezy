import chalk from "chalk";
import { ENV_KEYS } from "../core/config.js";
import { FreshSqueezyError } from "../core/errors.js";
import type {
  DoctorReport,
  ValidationIssue,
  ValidationResult,
  ValidationTarget,
} from "../core/types.js";

export const MISSING_API_KEY_HINTS = [
  "fresh-squeezy init",
  `export ${ENV_KEYS.apiKey}=ls_live_or_test_key`,
];

const brand = chalk.green.bold("fresh-squeezy");
const divider = chalk.dim("•");

export const renderBrandHeader = (title: string, subtitle?: string): string => {
  const lines = [`${brand} ${divider} ${chalk.bold(title)}`];
  if (subtitle) lines.push(chalk.dim(subtitle));
  lines.push("");
  return lines.join("\n");
};

export const renderStep = (
  index: number,
  total: number,
  title: string,
  detail?: string,
): string => {
  const suffix = detail ? ` ${chalk.dim(detail)}` : "";
  const prefix = index > 1 ? "\n" : "";
  return `${prefix}${chalk.yellow("●")} ${chalk.dim(`${index}/${total}`)} ${chalk.bold(title)}${suffix}\n`;
};

export const renderDetected = (label: string, value: string, source?: string): string => {
  const suffix = source ? ` ${chalk.dim(`from ${source}`)}` : "";
  return `  ${chalk.green("✓")} ${chalk.bold(label)} ${value}${suffix}\n`;
};

export const renderCommandExamples = (): string => {
  return [
    renderBrandHeader("Command examples", "Direct commands stay stable for scripts and CI."),
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

/**
 * Human-readable pretty-printer for a validation result. Keeps color logic in
 * one place so doctor/validate commands share formatting and consumers can
 * redirect stdout without ANSI codes leaking through (chalk auto-detects TTY).
 */
export const renderResult = (result: ValidationResult): string => {
  const lines: string[] = [];
  const badge = result.ok ? chalk.green("PASS") : chalk.red("FAIL");
  const mode = chalk.dim(`[${result.mode}]`);
  const target = renderTarget(result.target);
  const suffix = target ? ` ${chalk.dim(target)}` : "";
  lines.push(`${badge} ${mode} ${chalk.bold(result.name)}${suffix}`);

  for (const issue of result.issues) {
    lines.push(`  ${renderIssueLine(issue)}`);
    if (issue.suggestedFix) {
      lines.push(`    ${chalk.dim("fix:")} ${issue.suggestedFix}`);
    }
  }

  return lines.join("\n");
};

const renderTarget = (target: ValidationTarget | undefined): string => {
  if (!target) return "";
  const parts = [target.label];
  if (target.id) parts.push(`id ${target.id}`);
  if (target.url && target.url !== target.label) parts.push(target.url);
  return parts.join(" - ");
};

export const renderReport = (report: DoctorReport): string => {
  const header = report.ok
    ? chalk.green.bold("fresh-squeezy doctor: OK")
    : chalk.red.bold("fresh-squeezy doctor: FAILED");
  const failed = report.results.filter((result) => !result.ok).length;
  const summary =
    failed === 0
      ? chalk.dim(`${report.results.length} checks passed`)
      : chalk.dim(`${failed}/${report.results.length} checks failed`);
  const body = report.results.map(renderResult).join("\n\n");
  return `${header} ${chalk.dim(`(mode: ${report.mode})`)}\n${summary}\n\n${body}`;
};

const renderIssueLine = (issue: ValidationIssue): string => {
  const label =
    issue.severity === "error"
      ? chalk.red("✗ error")
      : issue.severity === "warning"
        ? chalk.yellow("! warn ")
        : chalk.blue("i info ");
  return `${label} ${chalk.gray(`[${issue.code}]`)} ${issue.message}`;
};

export const renderCliError = (message: string, hints: string[] = []): string => {
  const lines = [`fresh-squeezy: ${message}`];

  if (hints.length > 0) {
    lines.push("", "Try:");
    for (const hint of hints) {
      lines.push(`  ${hint}`);
    }
  }

  return `${lines.join("\n")}\n`;
};

const isFreshSqueezyError = (err: unknown): err is FreshSqueezyError => {
  return err instanceof FreshSqueezyError;
};

export const getDoctorHints = (err: unknown): string[] => {
  if (!isFreshSqueezyError(err)) return [];

  if (err.code === "MISSING_API_KEY") {
    return MISSING_API_KEY_HINTS;
  }

  if (err.code === "INVALID_MODE") {
    return ["fresh-squeezy doctor --mode test", "fresh-squeezy doctor --mode live"];
  }

  if (err.code === "NO_STORES") {
    return ["Check that the API key belongs to an account with a Lemon Squeezy store."];
  }

  return [];
};
