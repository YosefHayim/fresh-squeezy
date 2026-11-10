import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

const PACKAGE_FOLDER = resolve(import.meta.dirname, "..");
const CACHE_FOLDER = join(
	PACKAGE_FOLDER,
	"node_modules/.cache/fresh-squeezy-e2e",
);
const EMPTY_FOLDER = join(CACHE_FOLDER, "cwd");
const ENVIRONMENT_FILE_FOLDER = join(CACHE_FOLDER, "file-cwd");

const DOCTOR_COMMAND = "doctor";
const JSON_FLAG = "--json";
const STORE_ID_FLAG = "--store-id";
const MODE_FLAG = "--mode";
const PRODUCT_ID_FLAG = "--product-id";
const ALL_RESOURCES_FLAG = "--all-resources";
const UNKNOWN_FLAG = "--nope";
const UNKNOWN_MODE = "staging";
const LIVE_MODE = "live";
const REJECTED_KEY = "rejected-key";
const AUTH_FAILED_CODE = "AUTH_FAILED";
const DISCOUNT_CHECK_NAME = "discount";
const UTF8_ENCODING = "utf8";

interface CliRunSettings {
	environment?: Record<string, string | undefined>;
	folder?: string;
}

interface CliDoctorFinding {
	code: string;
	suggestedFix: string | null;
	details: Record<string, unknown> | null;
}

interface CliDoctorCheck {
	name: string;
	findings: CliDoctorFinding[];
	target: { label: string; id: string | null; url: string | null } | null;
}

interface CliDoctorReport {
	ok: boolean;
	mode: string;
	reports: { checks: CliDoctorCheck[] }[];
}

const runCli = (
	cliFlags: string[],
	{ environment, folder = EMPTY_FOLDER }: CliRunSettings = {},
) => {
	const childEnvironment = {
		LEMON_SQUEEZY_TEST_API_KEY: "test-key",
		NO_COLOR: "1",
		...environment,
	};
	const fakeApiPath = join(PACKAGE_FOLDER, "e2e/fake-api.mjs");
	const cliPath = join(CACHE_FOLDER, "cli.js");

	const cliRun = spawnSync(
		process.execPath,
		["--import", fakeApiPath, cliPath, ...cliFlags],
		{
			cwd: folder,
			encoding: UTF8_ENCODING,
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
	const doctorReport: CliDoctorReport = JSON.parse(stdout);
	return doctorReport;
};

const writeEnvironmentFile = (lines: string[]) => {
	const environmentFilePath = join(ENVIRONMENT_FILE_FOLDER, ".env");

	const joinedLines = lines.join("\n");
	writeFileSync(environmentFilePath, `${joinedLines}\n`);
};

const tsdownTimeoutMilliseconds = 60_000;

beforeAll(() => {
	mkdirSync(EMPTY_FOLDER, { recursive: true });
	rmSync(ENVIRONMENT_FILE_FOLDER, { recursive: true, force: true });
	mkdirSync(ENVIRONMENT_FILE_FOLDER, { recursive: true });

	const tsdownRun = spawnSync(
		"pnpm",
		[
			"exec",
			"tsdown",
			"--filter",
			"cli",
			"--out-dir",
			CACHE_FOLDER,
			"--logLevel",
			"silent",
		],
		{ cwd: PACKAGE_FOLDER, encoding: UTF8_ENCODING },
	);
	expect(tsdownRun.status, tsdownRun.stderr).toBe(0);
}, tsdownTimeoutMilliseconds);

describe("fresh-squeezy doctor", () => {
	test("prints a passing report and exits 0", () => {
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			PRODUCT_ID_FLAG,
			"100",
		];

		const { exitCode, stdout } = runCli(cliFlags);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("fresh-squeezy doctor: OK (mode: test)");
		expect(stdout).toContain("PASS [test] product");
	});

	test("with --json prints ok, mode and reports", () => {
		const cliFlags = [DOCTOR_COMMAND, STORE_ID_FLAG, "1", JSON_FLAG];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		const reportKeys = Object.keys(doctorReport);
		expect(exitCode).toBe(0);
		expect(reportKeys).toEqual(["ok", "mode", "reports"]);
		expect(doctorReport.ok).toBe(true);
		expect(doctorReport.reports).toHaveLength(1);
		expect(doctorReport.reports[0]?.checks[0]?.findings).toEqual([]);
		expect(doctorReport.reports[0]?.checks[0]?.target).toBeNull();
	});

	test("exits 1 when a check fails", () => {
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			"--discount-id",
			"601",
			JSON_FLAG,
		];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		const checks = doctorReport.reports[0]?.checks ?? [];
		const discount = checks.find((check) => check.name === DISCOUNT_CHECK_NAME);
		expect(exitCode).toBe(1);
		expect(doctorReport.ok).toBe(false);
		expect(discount?.findings[0]?.code).toBe("DISCOUNT_EXPIRED");
	});

	test("with --json gives each finding a suggested fix and details, never context", () => {
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			"--discount-id",
			"601",
			JSON_FLAG,
		];

		const { stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		const checks = doctorReport.reports[0]?.checks ?? [];
		const discount = checks.find((check) => check.name === DISCOUNT_CHECK_NAME);
		const expiredFinding = discount?.findings[0];
		expect(expiredFinding?.suggestedFix).toEqual(expect.any(String));
		expect(expiredFinding?.details).toEqual(expect.any(Object));
		expect(expiredFinding).not.toHaveProperty("context");
	});

	test("reports AUTH_FAILED once for a rejected key", () => {
		const cliFlags = [DOCTOR_COMMAND, STORE_ID_FLAG, "1", JSON_FLAG];
		const environment = { LEMON_SQUEEZY_TEST_API_KEY: REJECTED_KEY };

		const { exitCode, stdout } = runCli(cliFlags, { environment });

		const doctorReport = readDoctorReport(stdout);
		const checks = doctorReport.reports[0]?.checks ?? [];
		expect(exitCode).toBe(1);
		expect(checks).toHaveLength(1);
		expect(checks[0]?.findings[0]?.code).toBe(AUTH_FAILED_CODE);
	});

	test("reports AUTH_FAILED in every check when the key is revoked after connecting", () => {
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			PRODUCT_ID_FLAG,
			"100",
			JSON_FLAG,
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
		expect(codes).toEqual([AUTH_FAILED_CODE, AUTH_FAILED_CODE]);
	});

	test("repeats --store-id to check several stores", () => {
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			STORE_ID_FLAG,
			"2",
			JSON_FLAG,
		];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(0);
		expect(doctorReport.reports).toHaveLength(2);
	});

	test("checks every store when no store flag is given", () => {
		const cliFlags = [DOCTOR_COMMAND, JSON_FLAG];

		const { exitCode, stdout } = runCli(cliFlags);

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(0);
		expect(doctorReport.reports).toHaveLength(2);
	});

	test("with --all-resources checks every resource of the store", () => {
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			ALL_RESOURCES_FLAG,
			JSON_FLAG,
		];
		const expectedNames = [
			"product",
			"webhook",
			DISCOUNT_CHECK_NAME,
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
		const cliFlags = [DOCTOR_COMMAND, UNKNOWN_FLAG];

		const { exitCode, stderr } = runCli(cliFlags);

		expect(exitCode).toBe(2);
		expect(stderr).toContain(UNKNOWN_FLAG);
	});

	test("exits 2 for a bad mode", () => {
		const cliFlags = [DOCTOR_COMMAND, MODE_FLAG, UNKNOWN_MODE];

		const { exitCode, stderr } = runCli(cliFlags);

		expect(exitCode).toBe(2);
		expect(stderr).toContain(UNKNOWN_MODE);
	});

	test("with --mode live picks the live API key", () => {
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			MODE_FLAG,
			LIVE_MODE,
			JSON_FLAG,
		];
		const environment = { LEMON_SQUEEZY_LIVE_API_KEY: REJECTED_KEY };

		const { stdout } = runCli(cliFlags, { environment });

		const doctorReport = readDoctorReport(stdout);
		expect(doctorReport.mode).toBe(LIVE_MODE);
		expect(doctorReport.reports[0]?.checks[0]?.findings[0]?.code).toBe(
			AUTH_FAILED_CODE,
		);
	});

	test("ignores a LEMON_SQUEEZY_MODE variable and stays in test mode", () => {
		const cliFlags = [DOCTOR_COMMAND, STORE_ID_FLAG, "1", JSON_FLAG];
		const environment = { LEMON_SQUEEZY_MODE: LIVE_MODE };

		const { exitCode, stdout } = runCli(cliFlags, { environment });

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(0);
		expect(doctorReport.mode).toBe("test");
	});

	test("exits 2 when there is no API key", () => {
		const cliFlags = [DOCTOR_COMMAND];
		const environment = { LEMON_SQUEEZY_TEST_API_KEY: undefined };

		const { exitCode, stderr } = runCli(cliFlags, { environment });

		expect(exitCode).toBe(2);
		expect(stderr).toContain("LEMON_SQUEEZY_TEST_API_KEY");
	});

	test("reads the API key from the environment file in the working directory", () => {
		writeEnvironmentFile([`LEMON_SQUEEZY_TEST_API_KEY=${REJECTED_KEY}`]);
		const cliFlags = [DOCTOR_COMMAND, STORE_ID_FLAG, "1", JSON_FLAG];
		const environment = { LEMON_SQUEEZY_TEST_API_KEY: undefined };

		const { exitCode, stdout } = runCli(cliFlags, {
			folder: ENVIRONMENT_FILE_FOLDER,
			environment,
		});

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(1);
		expect(doctorReport.reports[0]?.checks[0]?.findings[0]?.code).toBe(
			AUTH_FAILED_CODE,
		);
	});

	test("reads the live API key from the environment file with --mode live", () => {
		writeEnvironmentFile([`LEMON_SQUEEZY_LIVE_API_KEY=${REJECTED_KEY}`]);
		const cliFlags = [
			DOCTOR_COMMAND,
			STORE_ID_FLAG,
			"1",
			MODE_FLAG,
			LIVE_MODE,
			JSON_FLAG,
		];

		const { exitCode, stdout } = runCli(cliFlags, {
			folder: ENVIRONMENT_FILE_FOLDER,
		});

		const doctorReport = readDoctorReport(stdout);
		expect(exitCode).toBe(1);
		expect(doctorReport.mode).toBe(LIVE_MODE);
		expect(doctorReport.reports[0]?.checks[0]?.findings[0]?.code).toBe(
			AUTH_FAILED_CODE,
		);
	});

	test("prefers a variable already set in the environment over the .env file", () => {
		writeEnvironmentFile([`LEMON_SQUEEZY_TEST_API_KEY=${REJECTED_KEY}`]);
		const cliFlags = [DOCTOR_COMMAND, STORE_ID_FLAG, "1"];

		const { exitCode, stdout } = runCli(cliFlags, {
			folder: ENVIRONMENT_FILE_FOLDER,
		});

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
		expect(stdout).toContain(ALL_RESOURCES_FLAG);
	});

	test("prints the package version for --version", () => {
		const { exitCode, stdout } = runCli(["--version"]);
		const printedVersion = stdout.trim();

		expect(exitCode).toBe(0);
		expect(printedVersion).toMatch(/^\d+\.\d+\.\d+/);
	});
});
