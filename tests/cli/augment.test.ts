import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAugmentCommand } from "../../src/cli/commands/augment.js";

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "fresh-squeezy-augment-"));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runAugmentCommand", () => {
  it("emits the with-sdk file when @lemonsqueezy/lemonsqueezy.js is in package.json", async () => {
    writeFileSync(
      join(workdir, "package.json"),
      JSON.stringify({
        name: "consumer",
        dependencies: { "@lemonsqueezy/lemonsqueezy.js": "^4.0.0" },
      })
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runAugmentCommand({ cwd: workdir });

    expect(code).toBe(0);
    const out = readFileSync(join(workdir, "lemonsqueezy.augment.d.ts"), "utf8");
    expect(out).toContain('from "@lemonsqueezy/lemonsqueezy.js"');
    expect(out).toContain("LemonSqueezyAugmented");
    expect(out).toContain("LatestSubscriptionFields");
    expect(out).toContain("LatestCheckoutFields");
    expect(out).toContain("LatestSubscriptionInvoiceFields");
    expect(out).toContain("GeneratedLemonSqueezyFieldMap");
    expect(out).toContain("LatestFieldsFor");
  });

  it("emits the generic file when the SDK is not installed", async () => {
    writeFileSync(
      join(workdir, "package.json"),
      JSON.stringify({ name: "consumer", dependencies: { other: "^1.0.0" } })
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runAugmentCommand({ cwd: workdir });

    expect(code).toBe(0);
    const out = readFileSync(join(workdir, "lemonsqueezy.augment.d.ts"), "utf8");
    expect(out).not.toContain('from "@lemonsqueezy/lemonsqueezy.js"');
    expect(out).toContain("WithLatestLemonSqueezyFields");
    expect(out).toContain('"checkout"');
    expect(out).toContain("LatestOrderItemFields");
    expect(out).toContain("GeneratedLemonSqueezyResourceName");
  });

  it("emits the generic file with --force even when the SDK is detected", async () => {
    writeFileSync(
      join(workdir, "package.json"),
      JSON.stringify({
        name: "consumer",
        dependencies: { "@lemonsqueezy/lemonsqueezy.js": "^4.0.0" },
      })
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runAugmentCommand({ cwd: workdir, force: true });

    expect(code).toBe(0);
    const out = readFileSync(join(workdir, "lemonsqueezy.augment.d.ts"), "utf8");
    expect(out).not.toContain('from "@lemonsqueezy/lemonsqueezy.js"');
    expect(out).toContain("WithLatestLemonSqueezyFields");
  });

  it("falls back to generic when no package.json exists", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runAugmentCommand({ cwd: workdir });

    expect(code).toBe(0);
    const out = readFileSync(join(workdir, "lemonsqueezy.augment.d.ts"), "utf8");
    expect(out).toContain("WithLatestLemonSqueezyFields");
  });

  it("honors the --out path", async () => {
    writeFileSync(join(workdir, "package.json"), JSON.stringify({ name: "consumer" }));
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runAugmentCommand({ cwd: workdir, out: "types/ls.augment.d.ts" });

    expect(code).toBe(0);
    expect(() => readFileSync(join(workdir, "types/ls.augment.d.ts"), "utf8")).not.toThrow();
  });
});
