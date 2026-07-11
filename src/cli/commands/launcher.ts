import chalk from "chalk";
import { ENV_KEYS } from "../../core/config.js";
import {
  renderBrandHeader,
  renderCancelMessage,
  renderCommandExamples,
  renderDetected,
  renderStep,
} from "../brand.js";
import { type ProjectInstallResult, ensureFreshSqueezyDevDependency } from "../projectInstall.js";
import { type LauncherAction, isPromptCancel, pickLauncherAction } from "../prompts.js";
import { runDoctorCommand } from "./doctor.js";
import { runInitCommand } from "./init.js";

export interface LauncherCommandOptions {
  isInteractive: boolean;
  install?: boolean;
  packageVersion?: string;
}

export const runLauncherCommand = async (options: LauncherCommandOptions): Promise<number> => {
  if (!options.isInteractive) return 2;

  try {
    process.stdout.write(
      renderBrandHeader(
        "Project bootstrap",
        "Install the billing doctor locally, then verify Lemon Squeezy in one guided run.",
      ),
    );

    process.stdout.write(renderStep(1, 2, "Project dependency", "add fresh-squeezy when missing"));
    const installResult = await ensureFreshSqueezyDevDependency({
      skipInstall: options.install === false,
      packageVersion: options.packageVersion,
    });
    process.stdout.write(renderProjectInstallResult(installResult));

    // No key yet → the only useful next step is guided setup, so skip the menu.
    // With a key configured, open the interactive front door and route the choice.
    if (!process.env[ENV_KEYS.apiKey]?.trim()) {
      return startGuidedSetup();
    }
    return routeLauncherAction(await pickLauncherAction());
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
};

/**
 * Route a front-door menu choice to the same command handlers the flag-driven
 * CLI uses. `doctor` runs interactively so store selection falls through to the
 * TTY multi-select; `examples` prints the copy/paste cheatsheet; `exit` is a
 * clean no-op.
 */
const routeLauncherAction = async (action: LauncherAction): Promise<number> => {
  switch (action) {
    case "init":
      return startGuidedSetup();
    case "doctor":
      return runDoctorCommand({ isInteractive: true });
    case "examples":
      process.stdout.write(renderCommandExamples());
      return 0;
    case "exit":
      return 0;
  }
};

const startGuidedSetup = (): Promise<number> => {
  process.stdout.write(
    renderStep(2, 2, "Guided setup", "detect credentials, stores, and resources"),
  );
  return runInitCommand({ isInteractive: true });
};

const renderProjectInstallResult = (result: ProjectInstallResult): string => {
  if (result.status === "installed") {
    return renderDetected(
      "Dev dependency",
      "fresh-squeezy",
      `${result.packageManager ?? "npm"} install`,
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
};
