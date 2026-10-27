import chalk from "chalk";
import {
	ensureFreshSqueezyDevDependency,
	type ProjectInstallResult,
} from "@/app/project-install.js";
import {
	isPromptCancel,
	type LauncherAction,
	pickLauncherAction,
} from "@/app/prompts.js";
import {
	errorMessageOf,
	renderBrandHeader,
	renderCancelMessage,
	renderCommandExamples,
	renderDetected,
	renderStep,
} from "@/app/render.js";
import { readEnvApiKey } from "@/shared/config.js";
import { runDoctorCommand } from "./doctor-command.js";
import { runInitCommand } from "./init-command.js";
import { runManageCommand } from "./manage-command.js";

export interface LauncherCommandOptions {
	install?: boolean;
	packageVersion?: string;
}

export const runLauncherCommand = async (
	options: LauncherCommandOptions,
): Promise<number> => {
	try {
		const brandHeader = renderBrandHeader(
			"Project bootstrap",
			"Install the billing doctor locally, then verify Lemon Squeezy in one guided run.",
		);
		process.stdout.write(brandHeader);

		const dependencyStep = renderStep(
			1,
			2,
			"Project dependency",
			"add fresh-squeezy when missing",
		);
		process.stdout.write(dependencyStep);
		const installResult = await ensureFreshSqueezyDevDependency({
			skipInstall: options.install === false,
			packageVersion: options.packageVersion,
		});
		const installSummary = renderProjectInstallResult(installResult);
		process.stdout.write(installSummary);

		// A missing key skips the menu: guided setup is the only useful next step.
		const envApiKey = readEnvApiKey();
		const isApiKeyMissing = !envApiKey;
		if (isApiKeyMissing) return startGuidedSetup();
		const pickedAction = await pickLauncherAction();
		return routeLauncherAction(pickedAction);
	} catch (err) {
		const isCancel = isPromptCancel(err);
		if (isCancel) {
			const cancelMessage = renderCancelMessage();
			process.stderr.write(cancelMessage);
			return 130;
		}
		const message = errorMessageOf(err);
		const failureHeadline = chalk.red("fresh-squeezy bootstrap failed:");
		process.stderr.write(`${failureHeadline} ${message}\n\n`);
		const commandExamples = renderCommandExamples();
		process.stderr.write(commandExamples);
		return 1;
	}
};

const routeLauncherAction = async (action: LauncherAction): Promise<number> => {
	switch (action) {
		case "init":
			return startGuidedSetup();
		case "doctor":
			return runDoctorCommand({ isInteractive: true });
		case "manage":
			return runManageCommand();
		case "examples": {
			const commandExamples = renderCommandExamples();
			process.stdout.write(commandExamples);
			return 0;
		}
		case "exit":
			return 0;
	}
};

const startGuidedSetup = (): Promise<number> => {
	const setupStep = renderStep(
		2,
		2,
		"Guided setup",
		"detect credentials, stores, and resources",
	);
	process.stdout.write(setupStep);
	return runInitCommand({ isInteractive: true });
};

const PROJECT_INSTALL_LINES: Record<
	Exclude<ProjectInstallResult["status"], "installed">,
	string
> = {
	"already-present": renderDetected(
		"Dev dependency",
		"fresh-squeezy",
		"package.json",
	),
	"self-package": renderDetected(
		"Project",
		"fresh-squeezy source repo",
		"package.json",
	),
	skipped: chalk.dim("  Skipped dev dependency install (--no-install).\n"),
	"no-package-json": chalk.yellow(
		"  No package.json found; running without installing a dev dependency.\n",
	),
};

const renderProjectInstallResult = (
	installOutcome: ProjectInstallResult,
): string => {
	const { status, packageManager = "npm" } = installOutcome;
	const isNotInstalled = status !== "installed";
	if (isNotInstalled) return PROJECT_INSTALL_LINES[status];
	return renderDetected(
		"Dev dependency",
		"fresh-squeezy",
		`${packageManager} install`,
	);
};
