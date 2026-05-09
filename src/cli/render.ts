import chalk from "chalk";
import type {
  DoctorReport,
  ValidationIssue,
  ValidationResult,
  ValidationTarget,
} from "../core/types.js";

/**
 * Human-readable pretty-printer for a validation result. Keeps color logic in
 * one place so doctor/validate commands share formatting and consumers can
 * redirect stdout without ANSI codes leaking through (chalk auto-detects TTY).
 */
export function renderResult(result: ValidationResult): string {
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
}

function renderTarget(target: ValidationTarget | undefined): string {
  if (!target) return "";
  const parts = [target.label];
  if (target.id) parts.push(`id ${target.id}`);
  if (target.url && target.url !== target.label) parts.push(target.url);
  return parts.join(" - ");
}

export function renderReport(report: DoctorReport): string {
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
}

function renderIssueLine(issue: ValidationIssue): string {
  const label =
    issue.severity === "error"
      ? chalk.red("✗ error")
      : issue.severity === "warning"
        ? chalk.yellow("! warn ")
        : chalk.blue("i info ");
  return `${label} ${chalk.gray(`[${issue.code}]`)} ${issue.message}`;
}
