import chalk from "chalk";

const brand = chalk.green.bold("fresh-squeezy");
const divider = chalk.dim("•");

export function renderBrandHeader(title: string, subtitle?: string): string {
  const lines = [`${brand} ${divider} ${chalk.bold(title)}`];
  if (subtitle) lines.push(chalk.dim(subtitle));
  lines.push("");
  return lines.join("\n");
}

export function renderStep(index: number, total: number, title: string, detail?: string): string {
  const suffix = detail ? ` ${chalk.dim(detail)}` : "";
  const prefix = index > 1 ? "\n" : "";
  return `${prefix}${chalk.yellow("●")} ${chalk.dim(`${index}/${total}`)} ${chalk.bold(title)}${suffix}\n`;
}

export function renderDetected(label: string, value: string, source?: string): string {
  const suffix = source ? ` ${chalk.dim(`from ${source}`)}` : "";
  return `  ${chalk.green("✓")} ${chalk.bold(label)} ${value}${suffix}\n`;
}

export function renderCommandExamples(): string {
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
    `${chalk.bold("Automation")}`,
    "  fresh-squeezy doctor --all-stores --json",
    "",
  ].join("\n");
}

export function renderCancelMessage(): string {
  return `${chalk.dim("fresh-squeezy cancelled.")}\n`;
}
