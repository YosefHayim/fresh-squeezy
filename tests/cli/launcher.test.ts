import { afterEach, describe, expect, it, vi } from "vitest";
import { runInitCommand } from "../../src/cli/commands/init.js";
import { runLauncherCommand } from "../../src/cli/commands/launcher.js";
import { ensureFreshSqueezyDevDependency } from "../../src/cli/projectInstall.js";

vi.mock("../../src/cli/projectInstall.js", () => ({
  ensureFreshSqueezyDevDependency: vi.fn(),
}));

vi.mock("../../src/cli/commands/init.js", () => ({
  runInitCommand: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("runLauncherCommand", () => {
  it("installs the project dependency and starts guided setup", async () => {
    vi.mocked(ensureFreshSqueezyDevDependency).mockResolvedValueOnce({
      status: "installed",
      packageManager: "npm",
    });
    vi.mocked(runInitCommand).mockResolvedValueOnce(0);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runLauncherCommand({
      isInteractive: true,
      packageVersion: "0.1.8",
    });

    expect(code).toBe(0);
    expect(ensureFreshSqueezyDevDependency).toHaveBeenCalledWith({
      skipInstall: false,
      packageVersion: "0.1.8",
    });
    expect(runInitCommand).toHaveBeenCalledWith({ isInteractive: true });

    const output = stdout.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("Project bootstrap");
    expect(output).toContain("Dev dependency");
    expect(output).toContain("Guided setup");
  });

  it("honors --no-install and still runs guided setup", async () => {
    vi.mocked(ensureFreshSqueezyDevDependency).mockResolvedValueOnce({ status: "skipped" });
    vi.mocked(runInitCommand).mockResolvedValueOnce(0);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runLauncherCommand({ isInteractive: true, install: false });

    expect(code).toBe(0);
    expect(ensureFreshSqueezyDevDependency).toHaveBeenCalledWith({
      skipInstall: true,
      packageVersion: undefined,
    });
    expect(runInitCommand).toHaveBeenCalledWith({ isInteractive: true });
  });

  it("does not run setup when dependency installation fails", async () => {
    vi.mocked(ensureFreshSqueezyDevDependency).mockRejectedValueOnce(new Error("npm failed"));
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const code = await runLauncherCommand({ isInteractive: true });

    expect(code).toBe(1);
    expect(runInitCommand).not.toHaveBeenCalled();
    const output = stderr.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("bootstrap failed");
    expect(output).toContain("npm failed");
  });

  it("does not bootstrap in non-interactive mode", async () => {
    const code = await runLauncherCommand({ isInteractive: false });

    expect(code).toBe(2);
    expect(ensureFreshSqueezyDevDependency).not.toHaveBeenCalled();
    expect(runInitCommand).not.toHaveBeenCalled();
  });
});
