import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const CACHE_DIR = join(ROOT, "node_modules/.cache/fresh-squeezy-e2e");
const EMPTY_CWD = join(CACHE_DIR, "cwd");
const FILE_CWD = join(CACHE_DIR, "file-cwd");
const CLI_PATH = join(CACHE_DIR, "cli.js");
const FAKE_API_PATH = join(ROOT, "e2e/fake-api.mjs");
const SETTINGS_FILE_NAME = ".env";

interface RunOptions {
	env?: Record<string, string | undefined>;
	cwd?: string;
}

interface ReportedResult {
	name: string;
	findings: { code: string }[];
}

const run = (args: string[], { env, cwd = EMPTY_CWD }: RunOptions = {}) => {
	const processEnv = {
		LEMON_SQUEEZY_TEST_API_KEY: "test-key",
		LEMON_SQUEEZY_MODE: "test",
		NO_COLOR: "1",
		...env,
	};
	const outcome = spawnSync(
		process.execPath,
		["--import", FAKE_API_PATH, CLI_PATH, ...args],
		{
			cwd,
			encoding: "utf8",
			env: processEnv,
		},
	);
	return {
		exitCode: outcome.status,
		stdout: outcome.stdout,
		stderr: outcome.stderr,
	};
};

const writeSettingsFile = (lines: string[]) => {
	const settingsPath = join(FILE_CWD, SETTINGS_FILE_NAME);
	writeFileSync(settingsPath, `${lines.join("\n")}\n`);
};

beforeAll(() => {
	mkdirSync(EMPTY_CWD, { recursive: true });
	rmSync(FILE_CWD, { recursive: true, force: true });
	mkdirSync(FILE_CWD, { recursive: true });
	const build = spawnSync(
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
	expect(build.status, build.stderr).toBe(0);
}, 60_000);

test("doctor prints a passing report and exits 0", () => {
	const { exitCode, stdout } = run([
		"doctor",
		"--store-id",
		"1",
		"--product-id",
		"100",
	]);

	expect(exitCode).toBe(0);
	expect(stdout).toContain("fresh-squeezy doctor: OK (mode: test)");
	expect(stdout).toContain("PASS [test] product");
});

test("doctor --json prints ok, mode and reports", () => {
	const { exitCode, stdout } = run(["doctor", "--store-id", "1", "--json"]);

	const parsed = JSON.parse(stdout);
	expect(exitCode).toBe(0);
	expect(Object.keys(parsed)).toEqual(["ok", "mode", "reports"]);
	expect(parsed.ok).toBe(true);
	expect(parsed.reports).toHaveLength(1);
	expect(parsed.reports[0].results[0].findings).toEqual([]);
});

test("doctor exits 1 when a check fails", () => {
	const { exitCode, stdout } = run([
		"doctor",
		"--store-id",
		"1",
		"--discount-id",
		"601",
		"--json",
	]);

	const parsed = JSON.parse(stdout);
	const results: ReportedResult[] = parsed.reports[0].results;
	const discount = results.find((entry) => entry.name === "discount");
	expect(exitCode).toBe(1);
	expect(parsed.ok).toBe(false);
	expect(discount?.findings[0]?.code).toBe("DISCOUNT_EXPIRED");
});

test("doctor reports AUTH_FAILED once for a rejected key", () => {
	const { exitCode, stdout } = run(["doctor", "--store-id", "1", "--json"], {
		env: { LEMON_SQUEEZY_TEST_API_KEY: "rejected-key" },
	});

	const parsed = JSON.parse(stdout);
	expect(exitCode).toBe(1);
	expect(parsed.reports[0].results).toHaveLength(1);
	expect(parsed.reports[0].results[0].findings[0].code).toBe("AUTH_FAILED");
});

test("doctor reports AUTH_FAILED in every check when the key is revoked after connecting", () => {
	const { exitCode, stdout } = run(
		["doctor", "--store-id", "1", "--product-id", "100", "--json"],
		{ env: { LEMON_SQUEEZY_TEST_API_KEY: "revoked-after-connect" } },
	);

	const parsed = JSON.parse(stdout);
	const results: ReportedResult[] = parsed.reports[0].results.slice(1);
	const codes = results.map((entry) => entry.findings[0]?.code);
	expect(exitCode).toBe(1);
	expect(codes).toEqual(["AUTH_FAILED", "AUTH_FAILED"]);
});

test("doctor repeats --store-id to check several stores", () => {
	const { exitCode, stdout } = run([
		"doctor",
		"--store-id",
		"1",
		"--store-id",
		"2",
		"--json",
	]);

	const parsed = JSON.parse(stdout);
	expect(exitCode).toBe(0);
	expect(parsed.reports).toHaveLength(2);
});

test("doctor checks every store when no store flag is given", () => {
	const { exitCode, stdout } = run(["doctor", "--json"]);

	const parsed = JSON.parse(stdout);
	expect(exitCode).toBe(0);
	expect(parsed.reports).toHaveLength(2);
});

test("doctor --all-resources checks every resource of the store", () => {
	const { exitCode, stdout } = run([
		"doctor",
		"--store-id",
		"1",
		"--all-resources",
		"--json",
	]);

	const parsed = JSON.parse(stdout);
	const results: ReportedResult[] = parsed.reports[0].results;
	const names = results.map((entry) => entry.name);
	expect(exitCode).toBe(1);
	expect(names).toEqual(
		expect.arrayContaining([
			"product",
			"webhook",
			"discount",
			"licenseKey",
			"subscriptionPlan",
		]),
	);
});

test("doctor exits 2 for an unknown flag", () => {
	const { exitCode, stderr } = run(["doctor", "--nope"]);

	expect(exitCode).toBe(2);
	expect(stderr).toContain("--nope");
});

test("doctor exits 2 for a bad mode", () => {
	const { exitCode, stderr } = run(["doctor", "--mode", "staging"]);

	expect(exitCode).toBe(2);
	expect(stderr).toContain("staging");
});

test("--mode picks the API key of that mode", () => {
	const { stdout } = run(
		["doctor", "--store-id", "1", "--mode", "live", "--json"],
		{ env: { LEMON_SQUEEZY_LIVE_API_KEY: "rejected-key" } },
	);

	const parsed = JSON.parse(stdout);
	expect(parsed.mode).toBe("live");
	expect(parsed.reports[0].results[0].findings[0].code).toBe("AUTH_FAILED");
});

test("doctor exits 2 when there is no API key", () => {
	const { exitCode, stderr } = run(["doctor"], {
		env: { LEMON_SQUEEZY_TEST_API_KEY: undefined },
	});

	expect(exitCode).toBe(2);
	expect(stderr).toContain("LEMON_SQUEEZY_TEST_API_KEY");
});

test("running without the doctor command prints the help to stderr and exits 2", () => {
	const { exitCode, stderr } = run([]);

	expect(exitCode).toBe(2);
	expect(stderr).toContain("Usage: fresh-squeezy doctor");
});

test("--help prints the help and exits 0", () => {
	const { exitCode, stdout } = run(["--help"]);

	expect(exitCode).toBe(0);
	expect(stdout).toContain("--all-resources");
});

test("--version prints the package version", () => {
	const { exitCode, stdout } = run(["--version"]);

	expect(exitCode).toBe(0);
	expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
});

test("doctor reads the API key from the settings file in the working directory", () => {
	writeSettingsFile([
		"LEMON_SQUEEZY_TEST_API_KEY=from-file",
		"LEMON_SQUEEZY_MODE=test",
	]);

	const { exitCode, stdout } = run(["doctor", "--store-id", "1"], {
		cwd: FILE_CWD,
		env: { LEMON_SQUEEZY_TEST_API_KEY: undefined },
	});

	expect(exitCode).toBe(0);
	expect(stdout).toContain("(mode: test)");
});

test("a variable already set in the environment wins over the settings file", () => {
	writeSettingsFile([
		"LEMON_SQUEEZY_TEST_API_KEY=from-file",
		"LEMON_SQUEEZY_MODE=live",
	]);

	const { exitCode, stdout } = run(["doctor", "--store-id", "1"], {
		cwd: FILE_CWD,
	});

	expect(exitCode).toBe(0);
	expect(stdout).toContain("(mode: test)");
});
