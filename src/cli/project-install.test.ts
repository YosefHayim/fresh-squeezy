import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
	type RunPackageCommand,
	ensureFreshSqueezyDevDependency,
} from "./project-install.js";

let workdir: string;

beforeEach(() => {
	workdir = mkdtempSync(join(tmpdir(), "fresh-squeezy-install-"));
});

afterEach(() => {
	rmSync(workdir, { recursive: true, force: true });
});

test("ensureFreshSqueezyDevDependency returns no-package-json when no project manifest is found", async () => {
	const runCommand = vi.fn<RunPackageCommand>();

	const installation = await ensureFreshSqueezyDevDependency({
		cwd: workdir,
		runCommand,
	});

	expect(installation.status).toBe("no-package-json");
	expect(runCommand).not.toHaveBeenCalled();
});

test("ensureFreshSqueezyDevDependency skips installation inside the fresh-squeezy source package", async () => {
	writePackageJson({ name: "fresh-squeezy" });
	const runCommand = vi.fn<RunPackageCommand>();

	const installation = await ensureFreshSqueezyDevDependency({
		cwd: workdir,
		runCommand,
	});

	expect(installation.status).toBe("self-package");
	expect(runCommand).not.toHaveBeenCalled();
});

test("ensureFreshSqueezyDevDependency skips installation when the dependency is already present", async () => {
	writePackageJson({
		name: "app",
		devDependencies: { "fresh-squeezy": "^0.1.8" },
	});
	const runCommand = vi.fn<RunPackageCommand>();

	const installation = await ensureFreshSqueezyDevDependency({
		cwd: workdir,
		runCommand,
	});

	expect(installation.status).toBe("already-present");
	expect(installation.packageManager).toBe("npm");
	expect(runCommand).not.toHaveBeenCalled();
});

test("ensureFreshSqueezyDevDependency uses npm by default and installs the current package version", async () => {
	writePackageJson({ name: "app" });
	const runCommand = vi.fn<RunPackageCommand>().mockResolvedValue(0);

	const installation = await ensureFreshSqueezyDevDependency({
		cwd: workdir,
		packageVersion: "0.1.8",
		runCommand,
	});

	expect(installation.status).toBe("installed");
	expect(installation.command).toEqual([
		"npm",
		"install",
		"--save-dev",
		"fresh-squeezy@0.1.8",
	]);
	expect(runCommand).toHaveBeenCalledWith(
		"npm",
		["install", "--save-dev", "fresh-squeezy@0.1.8"],
		{
			cwd: workdir,
		},
	);
});

test("ensureFreshSqueezyDevDependency uses pnpm when pnpm-lock.yaml exists", async () => {
	writePackageJson({ name: "app" });
	writeFileSync(join(workdir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	const runCommand = vi.fn<RunPackageCommand>().mockResolvedValue(0);

	const installation = await ensureFreshSqueezyDevDependency({
		cwd: workdir,
		runCommand,
	});

	expect(installation.status).toBe("installed");
	expect(installation.command).toEqual(["pnpm", "add", "-D", "fresh-squeezy"]);
});

test("ensureFreshSqueezyDevDependency surfaces a failed package manager command", async () => {
	writePackageJson({ name: "app" });
	const runCommand = vi.fn<RunPackageCommand>().mockResolvedValue(1);

	await expect(
		ensureFreshSqueezyDevDependency({ cwd: workdir, runCommand }),
	).rejects.toThrow(
		"npm install --save-dev fresh-squeezy failed with exit code 1",
	);
});

const writePackageJson = (value: unknown): void => {
	writeFileSync(join(workdir, "package.json"), JSON.stringify(value, null, 2));
};
