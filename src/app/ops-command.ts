import { readFileSync } from "node:fs";
import { confirmResourceOp } from "@/app/prompts.js";
import { renderCliError } from "@/app/render.js";
import {
	findResourceVerb,
	invokeOp,
	listRegisteredResources,
	type OpVerb,
	resourceRegistry,
} from "@/features/ops/resource-registry.js";
import { resolveConfig } from "@/shared/config.js";
import type { Mode } from "@/shared/contracts.js";
import { freshSqueezyErrorOf, isFreshSqueezyError } from "@/shared/errors.js";
import { HttpClient } from "@/shared/http.js";
import {
	type BulkSelector,
	collectBulkTargets,
	executeBulk,
	previewTargets,
	renderBulkSummary,
	supportsBulk,
} from "./bulk-ops.js";

export interface ResourceOpCommandOptions {
	resource: string;
	verb: OpVerb | string;
	mode?: Mode;
	id?: string;
	storeIds?: string[];
	parentId?: string;
	body?: string;
	bodyFile?: string;
	yes?: boolean;
	json?: boolean;
	isInteractive?: boolean;
	listCatalog?: boolean;
	all?: boolean;
	ids?: string[];
	match?: string;
	dryRun?: boolean;
}

export const runResourceOpCommand = async (
	options: ResourceOpCommandOptions,
): Promise<number> => {
	const shouldListCatalog = options.listCatalog;
	if (shouldListCatalog) {
		writeCatalog(options.json ?? false);
		return 0;
	}

	const spec = findResourceVerb(options.resource, options.verb);
	const isThereNoSpec = !spec;
	if (isThereNoSpec) {
		const unknownOpScreen = renderCliError(
			`Unknown or unsupported op: ${options.verb} ${options.resource}`,
			[
				"fresh-squeezy ops --list",
				"fresh-squeezy get product --id 1",
				"fresh-squeezy list webhook --store-ids 1",
			],
		);
		process.stderr.write(unknownOpScreen);
		return 2;
	}

	const bulkError = validateBulkFlags(spec, options);
	if (bulkError) {
		const invalidArgsError = freshSqueezyErrorOf({
			code: "INVALID_ARGS",
			message: bulkError,
		});
		writeFatal(invalidArgsError, options.json ?? false);
		return 2;
	}

	try {
		const body = readBody(options);
		const isBodyMissing = spec.body === "required" && body === undefined;
		if (isBodyMissing) {
			throw freshSqueezyErrorOf({
				code: "MISSING_ARG",
				message: "This op requires a JSON body (--body or --body-file).",
			});
		}

		const config = resolveConfig({ mode: options.mode });
		const http = new HttpClient(config);
		// CLI flag wins; LEMON_SQUEEZY_STORE_ID (already in config) is the fallback.
		const storeId = options.storeIds?.[0] ?? config.storeId;

		const isBulk = Boolean(options.all || options.ids);
		if (isBulk) {
			return await runBulk(http, spec, config.mode, options, { storeId, body });
		}

		const allowed = await assertWriteSafety(spec, config.mode, options);
		const isWriteRefused = !allowed;
		if (isWriteRefused) return 2;

		const opBody = await invokeOp(http, options.resource, options.verb, {
			id: options.id,
			storeId,
			parentId: options.parentId,
			body,
		});

		const envelope = {
			ok: true as const,
			mode: config.mode,
			resource: spec.resource,
			verb: spec.verb,
			docs: `https://docs.lemonsqueezy.com/api/${spec.docsPath}`,
			data: opBody ?? null,
		};

		if (options.json) {
			const envelopeText = JSON.stringify(envelope, null, 2);
			process.stdout.write(`${envelopeText}\n`);
			return 0;
		}
		const bodyText = JSON.stringify(opBody ?? null, null, 2);
		process.stdout.write(
			`${spec.verb} ${spec.resource} — ok (mode=${config.mode})\n${bodyText}\n`,
		);
		return 0;
	} catch (err) {
		writeFatal(err, options.json ?? false);
		return 2;
	}
};

const writeCatalog = (asJson: boolean): void => {
	if (asJson) {
		const catalog = {
			resources: listRegisteredResources(),
			ops: resourceRegistry,
		};
		const catalogText = JSON.stringify(catalog, null, 2);
		process.stdout.write(`${catalogText}\n`);
		return;
	}
	process.stdout.write(
		"Docs-backed ops (Lemon Squeezy official API only):\n\n",
	);
	for (const entry of resourceRegistry) {
		const hasBody = entry.body && entry.body !== "none";
		const flagList = [
			entry.destructive ? "destructive" : undefined,
			hasBody ? `body=${entry.body}` : undefined,
		].filter(Boolean);
		const flags = flagList.join(", ");
		const flagsSuffix = flags ? `  (${flags})` : "";
		const verbColumn = entry.verb.padEnd(18);
		const resourceColumn = entry.resource.padEnd(22);
		process.stdout.write(
			`  ${verbColumn} ${resourceColumn} ${entry.docsPath}${flagsSuffix}\n`,
		);
	}
	process.stdout.write(
		"\nCatalog resources (product, variant, price, file, store, …) are read-only in the API.\n",
	);
};

type VerbSpec = NonNullable<ReturnType<typeof findResourceVerb>>;

const validateBulkFlags = (
	spec: VerbSpec,
	options: ResourceOpCommandOptions,
): string | undefined => {
	const isBulk = Boolean(options.all || options.ids);
	const isMatchWithoutAll = Boolean(options.match) && !options.all;
	const isBulkAndSingleSelector = Boolean(options.all && options.ids);
	const isSingle = !isBulk;
	if (isSingle && options.match) return "--match needs --all.";
	if (isSingle && options.dryRun) return "--dry-run needs --all or --ids.";
	if (isSingle) return undefined;
	const isBulkUnsupported = !supportsBulk(spec);
	if (isBulkUnsupported) {
		return `--all/--ids only apply to delete, cancel, and refund ops (not ${spec.verb} ${spec.resource}).`;
	}
	if (isBulkAndSingleSelector) return "Use either --all or --ids, not both.";
	if (options.id) {
		return "--id targets one resource; drop it when using --all or --ids.";
	}
	if (isMatchWithoutAll) return "--match needs --all.";
	return undefined;
};

const runBulk = async (
	http: HttpClient,
	spec: VerbSpec,
	mode: Mode,
	options: ResourceOpCommandOptions,
	scope: { storeId?: string; body?: unknown },
): Promise<number> => {
	const selector: BulkSelector = {
		all: options.all,
		ids: options.ids,
		match: options.match,
		storeId: scope.storeId,
		parentId: options.parentId,
	};
	const targets = await collectBulkTargets(http, spec, selector);

	const hasTargets = targets.length > 0;
	const shouldConfirm = !options.dryRun && hasTargets;
	const preview = previewTargets(targets);
	const allowed = shouldConfirm
		? await assertWriteSafety(spec, mode, options, {
				count: targets.length,
				preview,
			})
		: true;
	const isWriteRefused = !allowed;
	if (isWriteRefused) return 2;

	const summary = await executeBulk(http, spec, targets, {
		dryRun: options.dryRun,
		body: scope.body,
	});

	const hasFailures = summary.failed > 0;
	const exitCode = hasFailures ? 1 : 0;
	if (options.json) {
		const envelope = {
			ok: summary.failed === 0,
			mode,
			resource: spec.resource,
			verb: spec.verb,
			docs: `https://docs.lemonsqueezy.com/api/${spec.docsPath}`,
			...summary,
		};
		const envelopeText = JSON.stringify(envelope, null, 2);
		process.stdout.write(`${envelopeText}\n`);
		return exitCode;
	}
	process.stdout.write(`${spec.verb} ${spec.resource} (mode=${mode})\n`);
	const summaryText = renderBulkSummary(spec, summary);
	process.stdout.write(summaryText);
	return exitCode;
};

const assertWriteSafety = async (
	spec: VerbSpec,
	mode: Mode,
	options: ResourceOpCommandOptions,
	bulk?: { count: number; preview: string },
): Promise<boolean> => {
	const isWrite =
		spec.verb !== "get" &&
		spec.verb !== "list" &&
		spec.verb !== "current-usage";
	const isRead = !isWrite;
	if (isRead) return true;

	const needsGate = Boolean(spec.destructive) || mode === "live";
	const isUngated = !needsGate;
	if (isUngated) return true;

	if (options.yes) return true;

	if (options.isInteractive) {
		const what = bulk
			? `${spec.verb} ${bulk.count} ${spec.resource} item(s) (${bulk.preview})`
			: `${spec.verb} ${spec.resource}`;
		const isLive = mode === "live";
		const question = isLive ? `LIVE mode: allow ${what}?` : `Confirm ${what}?`;
		return confirmResourceOp(question);
	}

	const destructiveNote = spec.destructive ? " (destructive op)" : "";
	const allFlag = bulk ? " --all" : "";
	const refusalScreen = renderCliError(
		`${spec.verb} ${spec.resource} requires --yes in non-interactive ${mode} mode${destructiveNote}`,
		[
			`fresh-squeezy ${spec.verb} ${spec.resource}${allFlag} --yes …`,
			"Use test mode for safer experimentation: --mode test",
		],
	);
	process.stderr.write(refusalScreen);
	return false;
};

const readBody = (options: ResourceOpCommandOptions): unknown | undefined => {
	// Bodies come from flags only — never auto-read stdin (would hang non-TTY pipes).
	if (options.bodyFile) {
		const bodyFileText = readFileSync(options.bodyFile, "utf8");
		return JSON.parse(bodyFileText) as unknown;
	}
	const isBodyGiven = options.body !== undefined;
	if (isBodyGiven) return JSON.parse(options.body as string) as unknown;
	return undefined;
};

const writeFatal = (err: unknown, json: boolean): void => {
	const isKnownError = isFreshSqueezyError(err);
	const isNativeError = err instanceof Error;
	const message = isNativeError ? err.message : String(err);
	if (json) {
		const code = isKnownError ? err.code : "FATAL";
		const status = isKnownError ? err.status : undefined;
		const errorText = JSON.stringify(
			{ ok: false, error: { code, message, status } },
			null,
			2,
		);
		process.stderr.write(`${errorText}\n`);
		return;
	}
	const errorScreen = renderCliError(message, ["fresh-squeezy ops --list"]);
	process.stderr.write(errorScreen);
};
