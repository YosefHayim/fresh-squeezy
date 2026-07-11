import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type RunPackageCommand, ensureFreshSqueezyDevDependency } from "./projectInstall.js";

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "fresh-squeezy-install-"));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe("ensureFreshSqueezyDevDependency", () => {
  it("returns no-package-json when no project manifest is found", async () => {
    const runCommand = vi.fn<RunPackageCommand>();

    const result = await ensureFreshSqueezyDevDependency({ cwd: workdir, runCommand });

    expect(result.status).toBe("no-package-json");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("skips installation inside the fresh-squeezy source package", async () => {
    writePackageJson({ name: "fresh-squeezy" });
    const runCommand = vi.fn<RunPackageCommand>();

    const result = await ensureFreshSqueezyDevDependency({ cwd: workdir, runCommand });

    expect(result.status).toBe("self-package");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("skips installation when the dependency is already present", async () => {
    writePackageJson({ name: "app", devDependencies: { "fresh-squeezy": "^0.1.8" } });
    const runCommand = vi.fn<RunPackageCommand>();

    const result = await ensureFreshSqueezyDevDependency({ cwd: workdir, runCommand });

    expect(result.status).toBe("already-present");
    expect(result.packageManager).toBe("npm");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("uses npm by default and installs the current package version", async () => {
    writePackageJson({ name: "app" });
    const runCommand = vi.fn<RunPackageCommand>().mockResolvedValue(0);

    const result = await ensureFreshSqueezyDevDependency({
      cwd: workdir,
      packageVersion: "0.1.8",
      runCommand,
    });

    expect(result.status).toBe("installed");
    expect(result.command).toEqual(["npm", "install", "--save-dev", "fresh-squeezy@0.1.8"]);
    expect(runCommand).toHaveBeenCalledWith(
      "npm",
      ["install", "--save-dev", "fresh-squeezy@0.1.8"],
      {
        cwd: workdir,
      },
    );
  });

  it("uses pnpm when pnpm-lock.yaml exists", async () => {
    writePackageJson({ name: "app" });
    writeFileSync(join(workdir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    const runCommand = vi.fn<RunPackageCommand>().mockResolvedValue(0);

    const result = await ensureFreshSqueezyDevDependency({ cwd: workdir, runCommand });

    expect(result.status).toBe("installed");
    expect(result.command).toEqual(["pnpm", "add", "-D", "fresh-squeezy"]);
  });

  it("surfaces a failed package manager command", async () => {
    writePackageJson({ name: "app" });
    const runCommand = vi.fn<RunPackageCommand>().mockResolvedValue(1);

    await expect(ensureFreshSqueezyDevDependency({ cwd: workdir, runCommand })).rejects.toThrow(
      "npm install --save-dev fresh-squeezy failed with exit code 1",
    );
  });
});

const writePackageJson = (value: unknown): void => {
  writeFileSync(join(workdir, "package.json"), JSON.stringify(value, null, 2));
};
