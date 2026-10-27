import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const CACHE_DIR = join(ROOT, "node_modules/.cache/fresh-squeezy-e2e");
const EMPTY_CWD = join(CACHE_DIR, "cwd");
const FILE_CWD = join(CACHE_DIR, "file-cwd");
const CLI_PATH = join(CACHE_DIR, "cli.js");
const FAKE_API_PATH = join(ROOT, "e2e/fake-api.mjs");
const SETTINGS_FILE_NAME = ".env";
const TSUP_TIMEOUT_MS = 60_000;

interface CliRunSettings {
	environment?: Record<string, string | undefined>;
	cwd?: string;
}

interface ReportedCheck {
	name: string;
	findings: { code: string }[];
}

interface DoctorReport {
	ok: boolean;
	mode: string;
	reports: { checks: ReportedCheck[] }[];
}

const runCli = (
	cliFlags: string[],
	{ environment, cwd = EMPTY_CWD }: CliRunSettings = {},
) => {
	const childEnvironment = {
		LEMON_SQUEEZY_TEST_API_KEY: "test-key",
		NO_COLOR: "1",
		...environment,
	};
	const cliRun = spawnSync(
		process.execPath,
		["--import", FAKE_API_PATH, CLI_PATH, ...cliFlags],
		{
			cwd,
			encoding: "utf8",
			env: childEnvironment,
		},
	);
	return {
		exitCode: cliRun.status,
		stdout: cliRun.stdout,
		stderr: cliRun.stderr,
	};
};

const readDoctorReport = (stdout: string) => {
	const doctorReport: DoctorReport = JSON.parse(stdout);
	return doctorReport;
};

const writeSettingsFile = (lines: string[]) => {
	const settingsPath = join(FILE_CWD, SETTINGS_FILE_NAME);
	const settingsFileLines = `${lines.join("\n")}\n`;
	writeFileSync(settingsPath, settingsFileLines);
};

beforeAll(() => {
	mkdirSync(EMPTY_CWD, { recursive: true });
	rmSync(FILE_CWD, { recursive: true, force: true });
	mkdirSync(FILE_CWD, { recursive: true });
	const tsupRun = spawnSync(
		"pnpm",
		[
			"exec",
			"tsup",
			"src/cli.ts",
			"--format",
			"esm",
			"--out-dir",
			CACHE_DIR,
			"--silent",
		],
		{ cwd: ROOT, encoding: "utf8" },
	);
	expect(tsupRun.status, tsupRun.stderr).toBe(0);
}, TSUP_TIMEOUT_MS);

describe("fresh-squeezy doctor", () => {
	test("prints a passing report and exits 0", () => {
		const cliFlags = ["doctor", "--store-id", "1", "--product-id", "100"];

		const { exitCode, stdout } = runCli(cliFlags);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("fresh-squeezy doctor: OK (mode: test)");
		expect(stdout).toContain("PASS [test] product");
	});

	test("with --json prints ok, mode and reports", () => {
		const cliFlags = ["doctor", "--store-id", "1", "--json"];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		const reportKeys = Object.keys(doctorReport);
		expect(exitCode).toBe(0);
		expect(reportKeys).toEqual(["ok", "mode", "reports"]);
		expect(doctorReport.ok).toBe(true);
		expect(doctorReport.reports).toHaveLength(1);
		expect(doctorReport.reports[0]?.checks[0]?.findings).toEqual([]);
	});

	test("exits 1 when a check fails", () => {
		const cliFlags = [
			"doctor",
			"--store-id",
			"1",
			"--discount-id",
			"601",
			"--json",
		];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		const checks = doctorReport.reports[0]?.checks ?? [];
		const discount = checks.find((check) => check.name === "discount");
		expect(exitCode).toBe(1);
		expect(doctorReport.ok).toBe(false);
		expect(discount?.findings[0]?.code).toBe("DISCOUNT_EXPIRED");
	});

	test("reports AUTH_FAILED once for a rejected key", () => {
		const cliFlags = ["doctor", "--store-id", "1", "--json"];
		const environment = { LEMON_SQUEEZY_TEST_API_KEY: "rejected-key" };

		const { exitCode, stdout } = runCli(cliFlags, { environment });

		const doctorReport = readDoctorReport(stdout);
		const checks = doctorReport.reports[0]?.checks ?? [];
		expect(exitCode).toBe(1);
		expect(checks).toHaveLength(1);
		expect(checks[0]?.findings[0]?.code).toBe("AUTH_FAILED");
	});

	test("reports AUTH_FAILED in every check when the key is revoked after connecting", () => {
		const cliFlags = [
			"doctor",
			"--store-id",
			"1",
			"--product-id",
			"100",
			"--json",
		];
		const environment = {
			LEMON_SQUEEZY_TEST_API_KEY: "revoked-after-connect",
		};

		const { exitCode, stdout } = runCli(cliFlags, { environment });

		const doctorReport = readDoctorReport(stdout);
		const allChecks = doctorReport.reports[0]?.checks ?? [];
		const checksAfterConnecting = allChecks.slice(1);
		const codes = checksAfterConnecting.map((check) => check.findings[0]?.code);
		expect(exitCode).toBe(1);
		expect(codes).toEqual(["AUTH_FAILED", "AUTH_FAILED"]);
	});

	test("repeats --store-id to check several stores", () => {
		const cliFlags = ["doctor", "--store-id", "1", "--store-id", "2", "--json"];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(0);
		expect(doctorReport.reports).toHaveLength(2);
	});

	test("checks every store when no store flag is given", () => {
		const cliFlags = ["doctor", "--json"];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(0);
		expect(doctorReport.reports).toHaveLength(2);
	});

	test("with --all-resources checks every resource of the store", () => {
		const cliFlags = ["doctor", "--store-id", "1", "--all-resources", "--json"];
		const expectedNames = [
			"product",
			"webhook",
			"discount",
			"licenseKey",
			"subscriptionPlan",
		];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		const checks = doctorReport.reports[0]?.checks ?? [];
		const names = checks.map((check) => check.name);
		const containsExpectedNames = expect.arrayContaining(expectedNames);
		expect(exitCode).toBe(1);
		expect(names).toEqual(containsExpectedNames);
	});

	test("exits 2 for an unknown flag", () => {
		const cliFlags = ["doctor", "--nope"];

		const { exitCode, stderr } = runCli(cliFlags);

		expect(exitCode).toBe(2);
		expect(stderr).toContain("--nope");
	});

	test("exits 2 for a bad mode", () => {
		const cliFlags = ["doctor", "--mode", "staging"];

		const { exitCode, stderr } = runCli(cliFlags);

		expect(exitCode).toBe(2);
		expect(stderr).toContain("staging");
	});

	test("with --mode live picks the live API key", () => {
		const cliFlags = ["doctor", "--store-id", "1", "--mode", "live", "--json"];
		const environment = { LEMON_SQUEEZY_LIVE_API_KEY: "rejected-key" };

		const { stdout } = runCli(cliFlags, { environment });

		const doctorReport = readDoctorReport(stdout);
		expect(doctorReport.mode).toBe("live");
		expect(doctorReport.reports[0]?.checks[0]?.findings[0]?.code).toBe(
			"AUTH_FAILED",
		);
	});

	test("ignores a LEMON_SQUEEZY_MODE variable and stays in test mode", () => {
		const cliFlags = ["doctor", "--store-id", "1", "--json"];
		const environment = { LEMON_SQUEEZY_MODE: "live" };

		const { exitCode, stdout } = runCli(cliFlags, { environment });

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(0);
		expect(doctorReport.mode).toBe("test");
	});

	test("exits 2 when there is no API key", () => {
		const cliFlags = ["doctor"];
		const environment = { LEMON_SQUEEZY_TEST_API_KEY: undefined };

		const { exitCode, stderr } = runCli(cliFlags, { environment });

		expect(exitCode).toBe(2);
		expect(stderr).toContain("LEMON_SQUEEZY_TEST_API_KEY");
	});

	test("reads the API key from the settings file in the working directory", () => {
		writeSettingsFile(["LEMON_SQUEEZY_TEST_API_KEY=rejected-key"]);
		const cliFlags = ["doctor", "--store-id", "1", "--json"];
		const environment = { LEMON_SQUEEZY_TEST_API_KEY: undefined };

		const { exitCode, stdout } = runCli(cliFlags, {
			cwd: FILE_CWD,
			environment,
		});

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(1);
		expect(doctorReport.reports[0]?.checks[0]?.findings[0]?.code).toBe(
			"AUTH_FAILED",
		);
	});

	test("reads the live API key from the settings file with --mode live", () => {
		writeSettingsFile(["LEMON_SQUEEZY_LIVE_API_KEY=rejected-key"]);
		const cliFlags = ["doctor", "--store-id", "1", "--mode", "live", "--json"];

		const { exitCode, stdout } = runCli(cliFlags, { cwd: FILE_CWD });

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(1);
		expect(doctorReport.mode).toBe("live");
		expect(doctorReport.reports[0]?.checks[0]?.findings[0]?.code).toBe(
			"AUTH_FAILED",
		);
	});

	test("prefers a variable already set in the environment over the settings file", () => {
		writeSettingsFile(["LEMON_SQUEEZY_TEST_API_KEY=rejected-key"]);
		const cliFlags = ["doctor", "--store-id", "1"];

		const { exitCode, stdout } = runCli(cliFlags, { cwd: FILE_CWD });

		expect(exitCode).toBe(0);
		expect(stdout).toContain("(mode: test)");
	});
});

describe("fresh-squeezy entry point", () => {
	test("prints the help to stderr and exits 2 without the doctor command", () => {
		const { exitCode, stderr } = runCli([]);

		expect(exitCode).toBe(2);
		expect(stderr).toContain("Usage: fresh-squeezy doctor");
	});

	test("prints the help and exits 0 for --help", () => {
		const { exitCode, stdout } = runCli(["--help"]);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("--all-resources");
	});

	test("prints the package version for --version", () => {
		const { exitCode, stdout } = runCli(["--version"]);

		expect(exitCode).toBe(0);
		expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
	});
});
