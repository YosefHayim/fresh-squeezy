import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ensureFreshSqueezyDevDependency } from "@/app/project-install.js";
import { pickLauncherAction } from "@/app/prompts.js";
import { runInitCommand } from "./init-command.js";
import { runLauncherCommand } from "./launcher-menu.js";
import { runManageCommand } from "./manage-command.js";

vi.mock("@/app/project-install.js", () => ({
	ensureFreshSqueezyDevDependency: vi.fn(),
}));

vi.mock("./init-command.js", () => ({
	runInitCommand: vi.fn(),
}));

vi.mock("./manage-command.js", () => ({
	runManageCommand: vi.fn(),
}));

vi.mock("@/app/prompts.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/app/prompts.js")>()),
	pickLauncherAction: vi.fn(),
}));

// No key configured → the launcher goes straight to guided setup, never the
// interactive menu. Keep that guarantee even if the runner env exports a key.
const API_KEY_ENV = "LEMON_SQUEEZY_API_KEY";
beforeEach(() => {
	vi.stubEnv(API_KEY_ENV, undefined);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

test("runLauncherCommand installs the project dependency and starts guided setup", async () => {
	vi.mocked(ensureFreshSqueezyDevDependency).mockResolvedValueOnce({
		status: "installed",
		packageManager: "npm",
	});
	vi.mocked(runInitCommand).mockResolvedValueOnce(0);
	const stdout = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);

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

test("runLauncherCommand honors --no-install and still runs guided setup", async () => {
	vi.mocked(ensureFreshSqueezyDevDependency).mockResolvedValueOnce({
		status: "skipped",
	});
	vi.mocked(runInitCommand).mockResolvedValueOnce(0);
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);

	const code = await runLauncherCommand({
		isInteractive: true,
		install: false,
	});

	expect(code).toBe(0);
	expect(ensureFreshSqueezyDevDependency).toHaveBeenCalledWith({
		skipInstall: true,
		packageVersion: undefined,
	});
	expect(runInitCommand).toHaveBeenCalledWith({ isInteractive: true });
});

test("runLauncherCommand does not run setup when dependency installation fails", async () => {
	vi.mocked(ensureFreshSqueezyDevDependency).mockRejectedValueOnce(
		new Error("npm failed"),
	);
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	const stderr = vi
		.spyOn(process.stderr, "write")
		.mockImplementation(() => true);

	const code = await runLauncherCommand({ isInteractive: true });

	expect(code).toBe(1);
	expect(runInitCommand).not.toHaveBeenCalled();
	const output = stderr.mock.calls.map((call) => String(call[0])).join("");
	expect(output).toContain("bootstrap failed");
	expect(output).toContain("npm failed");
});

test("runLauncherCommand does not bootstrap in non-interactive mode", async () => {
	const code = await runLauncherCommand({ isInteractive: false });

	expect(code).toBe(2);
	expect(ensureFreshSqueezyDevDependency).not.toHaveBeenCalled();
	expect(runInitCommand).not.toHaveBeenCalled();
});

test("runLauncherCommand routes the Manage resources menu choice to the bulk manager", async () => {
	vi.stubEnv(API_KEY_ENV, "test-key");
	vi.mocked(ensureFreshSqueezyDevDependency).mockResolvedValueOnce({
		status: "skipped",
	});
	vi.mocked(pickLauncherAction).mockResolvedValueOnce("manage");
	vi.mocked(runManageCommand).mockResolvedValueOnce(1);
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);

	const code = await runLauncherCommand({
		isInteractive: true,
		install: false,
	});

	expect(code).toBe(1);
	expect(runManageCommand).toHaveBeenCalledTimes(1);
	expect(runInitCommand).not.toHaveBeenCalled();
});
