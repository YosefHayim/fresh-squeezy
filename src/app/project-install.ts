import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const PACKAGE_NAME = "fresh-squeezy";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type ProjectInstallStatus =
	| "already-present"
	| "installed"
	| "no-package-json"
	| "self-package"
	| "skipped";

export interface ProjectInstallResult {
	status: ProjectInstallStatus;
	packageManager?: PackageManager;
	command?: string[];
}

export interface EnsureProjectInstallOptions {
	cwd?: string;
	packageVersion?: string;
	skipInstall?: boolean;
	runCommand?: RunPackageCommand;
}

export type RunPackageCommand = (
	command: string,
	args: string[],
	options: { cwd: string },
) => Promise<number>;

interface PackageJson {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

export const ensureFreshSqueezyDevDependency = async (
	options: EnsureProjectInstallOptions = {},
): Promise<ProjectInstallResult> => {
	const isInstallSkipped = Boolean(options.skipInstall);
	if (isInstallSkipped) {
		return { status: "skipped" };
	}

	const cwd = options.cwd ?? process.cwd();
	const packageJsonPath = await findPackageJson(cwd);
	const isThereNoPackageJson = !packageJsonPath;
	if (isThereNoPackageJson) {
		return { status: "no-package-json" };
	}

	const projectDir = path.dirname(packageJsonPath);
	const manifest = await readPackageJson(packageJsonPath);
	const isSelfPackage = manifest.name === PACKAGE_NAME;
	if (isSelfPackage) {
		return { status: "self-package" };
	}

	const packageManager = await detectPackageManager(projectDir);
	if (hasFreshSqueezy(manifest)) {
		return { status: "already-present", packageManager };
	}

	const isPackageVersionGiven = Boolean(options.packageVersion);
	const packageSpec = isPackageVersionGiven
		? `${PACKAGE_NAME}@${options.packageVersion}`
		: PACKAGE_NAME;
	const command = buildInstallCommand(packageManager, packageSpec);
	const [executable, ...installArgs] = command;
	const runCommand = options.runCommand ?? runPackageCommand;
	const code = await runCommand(executable, installArgs, {
		cwd: projectDir,
	});
	const hasInstallFailed = code !== 0;
	if (hasInstallFailed) {
		throw new Error(`${command.join(" ")} failed with exit code ${code}`);
	}

	return { status: "installed", packageManager, command };
};

const findPackageJson = async (cwd: string): Promise<string | undefined> => {
	let current = path.resolve(cwd);

	while (true) {
		const candidate = path.join(current, "package.json");
		if (await pathExists(candidate)) return candidate;

		const parent = path.dirname(current);
		const isAtFilesystemRoot = parent === current;
		if (isAtFilesystemRoot) return undefined;
		current = parent;
	}
};

const readPackageJson = async (
	packageJsonPath: string,
): Promise<PackageJson> => {
	const raw = await fs.readFile(packageJsonPath, "utf8");
	return JSON.parse(raw) as PackageJson;
};

const LOCKFILES: [file: string, manager: PackageManager][] = [
	["pnpm-lock.yaml", "pnpm"],
	["yarn.lock", "yarn"],
	["bun.lock", "bun"],
	["bun.lockb", "bun"],
];

const INSTALL_ARGS: Record<PackageManager, string[]> = {
	pnpm: ["add", "-D"],
	yarn: ["add", "-D"],
	bun: ["add", "-d"],
	npm: ["install", "--save-dev"],
};

const detectPackageManager = async (
	projectDir: string,
): Promise<PackageManager> => {
	for (const [file, manager] of LOCKFILES) {
		const lockPath = path.join(projectDir, file);
		const isLockfilePresent = await pathExists(lockPath);
		if (isLockfilePresent) return manager;
	}
	return "npm";
};

const hasFreshSqueezy = (manifest: PackageJson): boolean =>
	[
		manifest.dependencies,
		manifest.devDependencies,
		manifest.optionalDependencies,
		manifest.peerDependencies,
	].some((section) => section?.[PACKAGE_NAME] !== undefined);

const buildInstallCommand = (
	packageManager: PackageManager,
	packageSpec: string,
): [string, ...string[]] => [
	packageManager,
	...INSTALL_ARGS[packageManager],
	packageSpec,
];

const runPackageCommand = (
	command: string,
	args: string[],
	options: { cwd: string },
): Promise<number> =>
	new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			stdio: "inherit",
		});

		child.on("error", reject);
		child.on("close", (code) => resolve(code ?? 1));
	});

const pathExists = (filePath: string): Promise<boolean> =>
	fs.access(filePath).then(
		() => true,
		() => false,
	);
