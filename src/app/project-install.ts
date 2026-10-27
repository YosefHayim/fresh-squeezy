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
	projectDir?: string;
	packageJsonPath?: string;
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
		return { status: "self-package", projectDir, packageJsonPath };
	}

	const packageManager = await detectPackageManager(projectDir);
	if (hasFreshSqueezy(manifest)) {
		return {
			status: "already-present",
			projectDir,
			packageJsonPath,
			packageManager,
		};
	}

	const isPackageVersionGiven = Boolean(options.packageVersion);
	const packageSpec = isPackageVersionGiven
		? `${PACKAGE_NAME}@${options.packageVersion}`
		: PACKAGE_NAME;
	const command = buildInstallCommand(packageManager, packageSpec);
	const executable = command[0];
	const isThereNoExecutable = !executable;
	if (isThereNoExecutable) {
		throw new Error("No package manager command resolved.");
	}

	const runCommand = options.runCommand ?? runPackageCommand;
	const installArgs = command.slice(1);
	const code = await runCommand(executable, installArgs, {
		cwd: projectDir,
	});
	const hasInstallFailed = code !== 0;
	if (hasInstallFailed) {
		throw new Error(`${command.join(" ")} failed with exit code ${code}`);
	}

	return {
		status: "installed",
		projectDir,
		packageJsonPath,
		packageManager,
		command,
	};
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

const detectPackageManager = async (
	projectDir: string,
): Promise<PackageManager> => {
	const pnpmLockPath = path.join(projectDir, "pnpm-lock.yaml");
	const yarnLockPath = path.join(projectDir, "yarn.lock");
	const bunLockPath = path.join(projectDir, "bun.lock");
	const bunBinaryLockPath = path.join(projectDir, "bun.lockb");
	const hasPnpmLock = await pathExists(pnpmLockPath);
	if (hasPnpmLock) return "pnpm";
	const hasYarnLock = await pathExists(yarnLockPath);
	if (hasYarnLock) return "yarn";
	const hasBunLock = await pathExists(bunLockPath);
	const hasBunBinaryLock = await pathExists(bunBinaryLockPath);
	const hasAnyBunLock = hasBunLock || hasBunBinaryLock;
	if (hasAnyBunLock) return "bun";
	return "npm";
};

const hasFreshSqueezy = (manifest: PackageJson): boolean => {
	return [
		manifest.dependencies,
		manifest.devDependencies,
		manifest.optionalDependencies,
		manifest.peerDependencies,
	].some((section) => section?.[PACKAGE_NAME] !== undefined);
};

const buildInstallCommand = (
	packageManager: PackageManager,
	packageSpec: string,
): string[] => {
	const isPnpm = packageManager === "pnpm";
	const isYarn = packageManager === "yarn";
	const isBun = packageManager === "bun";
	if (isPnpm) return ["pnpm", "add", "-D", packageSpec];
	if (isYarn) return ["yarn", "add", "-D", packageSpec];
	if (isBun) return ["bun", "add", "-d", packageSpec];
	return ["npm", "install", "--save-dev", packageSpec];
};

const runPackageCommand = (
	command: string,
	args: string[],
	options: { cwd: string },
): Promise<number> => {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			stdio: "inherit",
			shell: false,
		});

		child.on("error", reject);
		child.on("close", (code) => resolve(code ?? 1));
	});
};

const pathExists = async (filePath: string): Promise<boolean> => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};
