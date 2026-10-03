import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const cacheDir = join(root, "node_modules/.cache/fresh-squeezy-e2e");
// Empty cwd so dotenv never picks up a developer's real .env.
const emptyCwd = join(cacheDir, "cwd");
const cli = join(cacheDir, "main.js");
const preload = join(root, "tests/e2e/fakeApi.mjs");

const run = (args: string[]) => {
  const res = spawnSync(process.execPath, ["--import", preload, cli, ...args], {
    cwd: emptyCwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      LEMON_SQUEEZY_API_KEY: "test-key",
      LEMON_SQUEEZY_MODE: "test",
    },
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
};

describe("CLI bulk ops e2e (built binary, fake API)", () => {
  beforeAll(() => {
    mkdirSync(emptyCwd, { recursive: true });
    const build = spawnSync(
      "pnpm",
      [
        "exec",
        "tsup",
        "src/cli/main.ts",
        "--no-config",
        "--format",
        "esm",
        "--out-dir",
        cacheDir,
        "--silent",
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(build.status, build.stderr).toBe(0);
  }, 60_000);

  it("delete --help documents the bulk flags and examples", () => {
    const { code, stdout } = run(["delete", "--help"]);
    expect(code).toBe(0);
    for (const needle of ["--all", "--ids <ids>", "--match <text>", "--dry-run", "Examples:"]) {
      expect(stdout).toContain(needle);
    }
  });

  it("--all --match --dry-run lists targets and deletes nothing", () => {
    const { code, stdout, stderr } = run([
      "delete",
      "discount",
      "--all",
      "--store-ids",
      "1",
      "--match",
      "nsah",
      "--dry-run",
      "--json",
    ]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, dryRun: true, total: 2 });
    expect(stderr).not.toContain("FAKE_DELETE");
  });

  it("--all --match --yes deletes only the matching discounts", () => {
    const { code, stdout, stderr } = run([
      "delete",
      "discount",
      "--all",
      "--store-ids",
      "1",
      "--match",
      "nsah",
      "--yes",
      "--json",
    ]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, total: 2, succeeded: 2, failed: 0 });
    expect(stderr).toContain("FAKE_DELETE 2");
    expect(stderr).toContain("FAKE_DELETE 3");
    expect(stderr).not.toContain("FAKE_DELETE 1");
  });

  it("exits 1 when one id fails", () => {
    const { code, stdout } = run(["delete", "discount", "--ids", "1,99", "--yes", "--json"]);
    expect(code).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({ ok: false, succeeded: 1, failed: 1 });
  });

  it("non-TTY without --yes is refused with exit 2", () => {
    const { code, stderr } = run(["delete", "discount", "--all", "--store-ids", "1"]);
    expect(code).toBe(2);
    expect(stderr).toContain("requires --yes");
    expect(stderr).not.toContain("FAKE_DELETE");
  });

  it("conflicting flags exit 2", () => {
    const { code, stderr } = run(["delete", "discount", "--all", "--ids", "1", "--json"]);
    expect(code).toBe(2);
    expect(stderr).toContain("either --all or --ids");
  });

  it("writes --json output larger than a 64 KB pipe buffer in full", () => {
    const { code, stdout } = run(["list", "product", "--store-ids", "1", "--json"]);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(65_536);
    expect(JSON.parse(stdout).data).toHaveLength(3000);
  });
});
