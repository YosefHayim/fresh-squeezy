import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const PACKAGE_NAME = "fresh-squeezy";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type ProjectInstallStatus =
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
  options: { cwd: string }
) => Promise<number>;

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export async function ensureFreshSqueezyDevDependency(
  options: EnsureProjectInstallOptions = {}
): Promise<ProjectInstallResult> {
  if (options.skipInstall) {
    return { status: "skipped" };
  }

  const cwd = options.cwd ?? process.cwd();
  const packageJsonPath = await findPackageJson(cwd);
  if (!packageJsonPath) {
    return { status: "no-package-json" };
  }

  const projectDir = path.dirname(packageJsonPath);
  const manifest = await readPackageJson(packageJsonPath);
  if (manifest.name === PACKAGE_NAME) {
    return { status: "self-package", projectDir, packageJsonPath };
  }

  const packageManager = await detectPackageManager(projectDir);
  if (hasFreshSqueezy(manifest)) {
    return { status: "already-present", projectDir, packageJsonPath, packageManager };
  }

  const packageSpec = options.packageVersion
    ? `${PACKAGE_NAME}@${options.packageVersion}`
    : PACKAGE_NAME;
  const command = buildInstallCommand(packageManager, packageSpec);
  const executable = command[0];
  if (!executable) throw new Error("No package manager command resolved.");

  const runCommand = options.runCommand ?? runPackageCommand;
  const code = await runCommand(executable, command.slice(1), { cwd: projectDir });
  if (code !== 0) {
    throw new Error(`${command.join(" ")} failed with exit code ${code}`);
  }

  return { status: "installed", projectDir, packageJsonPath, packageManager, command };
}

export async function findPackageJson(cwd: string): Promise<string | undefined> {
  let current = path.resolve(cwd);

  while (true) {
    const candidate = path.join(current, "package.json");
    if (await pathExists(candidate)) return candidate;

    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

async function readPackageJson(packageJsonPath: string): Promise<PackageJson> {
  const raw = await fs.readFile(packageJsonPath, "utf8");
  return JSON.parse(raw) as PackageJson;
}

async function detectPackageManager(projectDir: string): Promise<PackageManager> {
  if (await pathExists(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (await pathExists(path.join(projectDir, "yarn.lock"))) return "yarn";
  if (
    (await pathExists(path.join(projectDir, "bun.lock"))) ||
    (await pathExists(path.join(projectDir, "bun.lockb")))
  ) {
    return "bun";
  }
  return "npm";
}

function hasFreshSqueezy(manifest: PackageJson): boolean {
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((section) => section?.[PACKAGE_NAME] !== undefined);
}

function buildInstallCommand(packageManager: PackageManager, packageSpec: string): string[] {
  if (packageManager === "pnpm") return ["pnpm", "add", "-D", packageSpec];
  if (packageManager === "yarn") return ["yarn", "add", "-D", packageSpec];
  if (packageManager === "bun") return ["bun", "add", "-d", packageSpec];
  return ["npm", "install", "--save-dev", packageSpec];
}

function runPackageCommand(
  command: string,
  args: string[],
  options: { cwd: string }
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
