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
	isInteractive: boolean;
	install?: boolean;
	packageVersion?: string;
}

export const runLauncherCommand = async (
	options: LauncherCommandOptions,
): Promise<number> => {
	const isNotInteractive = !options.isInteractive;
	if (isNotInteractive) return 2;

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

		// No key yet → the only useful next step is guided setup, so skip the menu.
		// With a key configured, open the interactive front door and route the choice.
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
		const isErrorInstance = err instanceof Error;
		const message = isErrorInstance ? err.message : String(err);
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

const renderProjectInstallResult = (
	installOutcome: ProjectInstallResult,
): string => {
	const isInstalled = installOutcome.status === "installed";
	if (isInstalled) {
		const packageManager = installOutcome.packageManager ?? "npm";
		return renderDetected(
			"Dev dependency",
			"fresh-squeezy",
			`${packageManager} install`,
		);
	}

	const isAlreadyPresent = installOutcome.status === "already-present";
	if (isAlreadyPresent) {
		return renderDetected("Dev dependency", "fresh-squeezy", "package.json");
	}

	const isSelfPackage = installOutcome.status === "self-package";
	if (isSelfPackage) {
		return renderDetected(
			"Project",
			"fresh-squeezy source repo",
			"package.json",
		);
	}

	const isSkipped = installOutcome.status === "skipped";
	if (isSkipped) {
		return chalk.dim("  Skipped dev dependency install (--no-install).\n");
	}

	return chalk.yellow(
		"  No package.json found; running without installing a dev dependency.\n",
	);
};
