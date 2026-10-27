import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { silenceStdout } from "@e2e/mock-fetch.js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { runAugmentCommand } from "./augment-command.js";

let workdir: string;

beforeEach(() => {
	workdir = mkdtempSync(join(tmpdir(), "fresh-squeezy-augment-"));
});

afterEach(() => {
	rmSync(workdir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

const SDK_DEPENDENCIES = { "@lemonsqueezy/lemonsqueezy.js": "^4.0.0" };

const writeConsumerPackage = (dependencies?: Record<string, string>) => {
	const packageJson = JSON.stringify({ name: "consumer", dependencies });
	writeFileSync(join(workdir, "package.json"), packageJson);
};

const emitAugmentFile = async (
	options: { force?: boolean } = {},
): Promise<string> => {
	silenceStdout();
	const code = await runAugmentCommand({ cwd: workdir, ...options });
	expect(code).toBe(0);
	return readFileSync(join(workdir, "lemonsqueezy.augment.d.ts"), "utf8");
};

test("runAugmentCommand emits the with-sdk file when @lemonsqueezy/lemonsqueezy.js is in package.json", async () => {
	writeConsumerPackage(SDK_DEPENDENCIES);

	const out = await emitAugmentFile();

	expect(out).toContain('from "@lemonsqueezy/lemonsqueezy.js"');
	expect(out).toContain("LemonSqueezyAugmented");
	expect(out).toContain("LatestSubscriptionFields");
	expect(out).toContain("LatestCheckoutFields");
	expect(out).toContain("LatestSubscriptionInvoiceFields");
	expect(out).toContain("GeneratedLemonSqueezyFieldMap");
	expect(out).toContain("LatestFieldsFor");
	// Widened response map covers every SDK-response-shaped resource, not just the original four.
	expect(out).toContain(
		"AugmentResponse<SubscriptionInvoice, LatestSubscriptionInvoiceFields>",
	);
	expect(out).toContain("AugmentResponse<OrderItem, LatestOrderItemFields>");
	expect(out).toContain("AugmentResponse<Checkout, LatestCheckoutFields>");
});

test("runAugmentCommand emits the generic file when the SDK is not installed", async () => {
	writeConsumerPackage({ other: "^1.0.0" });

	const out = await emitAugmentFile();

	expect(out).not.toContain('from "@lemonsqueezy/lemonsqueezy.js"');
	expect(out).toContain("WithLatestLemonSqueezyFields");
	expect(out).toContain('"checkout"');
	expect(out).toContain("LatestOrderItemFields");
	expect(out).toContain("GeneratedLemonSqueezyResourceName");
});

test("runAugmentCommand emits the generic file with --force even when the SDK is detected", async () => {
	writeConsumerPackage(SDK_DEPENDENCIES);

	const out = await emitAugmentFile({ force: true });

	expect(out).not.toContain('from "@lemonsqueezy/lemonsqueezy.js"');
	expect(out).toContain("WithLatestLemonSqueezyFields");
});

test("runAugmentCommand falls back to generic when no package.json exists", async () => {
	const out = await emitAugmentFile();

	expect(out).toContain("WithLatestLemonSqueezyFields");
});

test("runAugmentCommand honors the --out path", async () => {
	writeConsumerPackage();
	silenceStdout();

	const code = await runAugmentCommand({
		cwd: workdir,
		out: "types/ls.augment.d.ts",
	});

	expect(code).toBe(0);
	expect(() =>
		readFileSync(join(workdir, "types/ls.augment.d.ts"), "utf8"),
	).not.toThrow();
});
