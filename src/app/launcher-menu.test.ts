import { silenceStdout } from "@e2e/mock-fetch.js";
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
	silenceStdout();
	vi.mocked(ensureFreshSqueezyDevDependency).mockResolvedValue({
		status: "skipped",
	});
	vi.mocked(runInitCommand).mockResolvedValue(0);
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
	const stdout = silenceStdout();

	const code = await runLauncherCommand({
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
	const code = await runLauncherCommand({
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
	const stderr = vi
		.spyOn(process.stderr, "write")
		.mockImplementation(() => true);

	const code = await runLauncherCommand({});

	expect(code).toBe(1);
	expect(runInitCommand).not.toHaveBeenCalled();
	const output = stderr.mock.calls.map((call) => String(call[0])).join("");
	expect(output).toContain("bootstrap failed");
	expect(output).toContain("npm failed");
});

test("runLauncherCommand routes the Manage resources menu choice to the bulk manager", async () => {
	vi.stubEnv(API_KEY_ENV, "test-key");
	vi.mocked(pickLauncherAction).mockResolvedValueOnce("manage");
	vi.mocked(runManageCommand).mockResolvedValueOnce(1);
	silenceStdout();

	const code = await runLauncherCommand({
		install: false,
	});

	expect(code).toBe(1);
	expect(runManageCommand).toHaveBeenCalledTimes(1);
	expect(runInitCommand).not.toHaveBeenCalled();
});
