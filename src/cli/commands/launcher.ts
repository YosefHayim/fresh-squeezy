import chalk from "chalk";
import {
  renderBrandHeader,
  renderCancelMessage,
  renderCommandExamples,
  renderDetected,
  renderStep,
} from "../brand.js";
import {
  ensureFreshSqueezyDevDependency,
  type ProjectInstallResult,
} from "../projectInstall.js";
import { isPromptCancel } from "../prompts.js";
import { runInitCommand } from "./init.js";

export interface LauncherCommandOptions {
  isInteractive: boolean;
  install?: boolean;
  packageVersion?: string;
}

export async function runLauncherCommand(options: LauncherCommandOptions): Promise<number> {
  if (!options.isInteractive) return 2;

  try {
    process.stdout.write(
      renderBrandHeader(
        "Project bootstrap",
        "Install the billing doctor locally, then verify Lemon Squeezy in one guided run."
      )
    );

    process.stdout.write(renderStep(1, 2, "Project dependency", "add fresh-squeezy when missing"));
    const installResult = await ensureFreshSqueezyDevDependency({
      skipInstall: options.install === false,
      packageVersion: options.packageVersion,
    });
    process.stdout.write(renderProjectInstallResult(installResult));

    process.stdout.write(renderStep(2, 2, "Guided setup", "detect credentials, stores, and resources"));
    return runInitCommand({ isInteractive: true });
  } catch (err) {
    if (isPromptCancel(err)) {
      process.stderr.write(renderCancelMessage());
      return 130;
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${chalk.red("fresh-squeezy bootstrap failed:")} ${message}\n\n`);
    process.stderr.write(renderCommandExamples());
    return 1;
  }
}

function renderProjectInstallResult(result: ProjectInstallResult): string {
  if (result.status === "installed") {
    return renderDetected(
      "Dev dependency",
      "fresh-squeezy",
      `${result.packageManager ?? "npm"} install`
    );
  }

  if (result.status === "already-present") {
    return renderDetected("Dev dependency", "fresh-squeezy", "package.json");
  }

  if (result.status === "self-package") {
    return renderDetected("Project", "fresh-squeezy source repo", "package.json");
  }

  if (result.status === "skipped") {
    return chalk.dim("  Skipped dev dependency install (--no-install).\n");
  }

  return chalk.yellow("  No package.json found; running without installing a dev dependency.\n");
}
