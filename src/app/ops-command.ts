import { readFileSync } from "node:fs";
import { confirmResourceOp } from "@/app/prompts.js";
import {
	errorMessageOf,
	OPS_LIST_HINTS,
	renderCliError,
	writeCliFailure,
} from "@/app/render.js";
import {
	findResourceVerb,
	invokeOp,
	type ResourceVerbSpec,
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

export interface OpsCommandOptions {
	mode?: Mode;
	id?: string;
	storeIds?: string[];
	parentId?: string;
	body?: string;
	bodyFile?: string;
	yes?: boolean;
	json?: boolean;
	isInteractive?: boolean;
	all?: boolean;
	ids?: string[];
	match?: string;
	dryRun?: boolean;
}

export interface ResourceOpCommandOptions extends OpsCommandOptions {
	resource: string;
	verb: string;
}

export const runResourceOpCommand = async (
	options: ResourceOpCommandOptions,
): Promise<number> => {
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
		writeOpsFailure(invalidArgsError, options.json);
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

		const isAllowed = await isWriteAllowed(spec, config.mode, options);
		const isWriteRefused = !isAllowed;
		if (isWriteRefused) return 2;

		const opBody = await invokeOp(http, options.resource, options.verb, {
			id: options.id,
			storeId,
			parentId: options.parentId,
			body,
		});

		const envelope = {
			ok: true,
			...opEnvelope(spec, config.mode),
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
		writeOpsFailure(err, options.json);
		return 2;
	}
};

const opEnvelope = (spec: ResourceVerbSpec, mode: Mode) => ({
	mode,
	resource: spec.resource,
	verb: spec.verb,
	docs: `https://docs.lemonsqueezy.com/api/${spec.docsPath}`,
});

const validateBulkFlags = (
	spec: ResourceVerbSpec,
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
	spec: ResourceVerbSpec,
	mode: Mode,
	options: ResourceOpCommandOptions,
	scope: { storeId?: string; body?: unknown },
): Promise<number> => {
	const selector: BulkSelector = {
		ids: options.ids,
		match: options.match,
		storeId: scope.storeId,
		parentId: options.parentId,
	};
	const targets = await collectBulkTargets(http, spec, selector);

	const hasTargets = targets.length > 0;
	const shouldConfirm = !options.dryRun && hasTargets;
	const preview = previewTargets(targets);
	const isAllowed = shouldConfirm
		? await isWriteAllowed(spec, mode, options, {
				count: targets.length,
				preview,
			})
		: true;
	const isWriteRefused = !isAllowed;
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
			...opEnvelope(spec, mode),
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

const isWriteAllowed = async (
	spec: ResourceVerbSpec,
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
	const { body } = options;
	const isBodyMissing = body === undefined;
	if (isBodyMissing) return undefined;
	return JSON.parse(body) as unknown;
};

// Ops keep their own pretty-printed failure JSON; text failures share the common writer.
const writeOpsFailure = (err: unknown, json: boolean | undefined): void => {
	const isTextRequested = !json;
	if (isTextRequested) {
		writeCliFailure(err, { hints: OPS_LIST_HINTS });
		return;
	}
	const isKnownError = isFreshSqueezyError(err);
	const code = isKnownError ? err.code : "FATAL";
	const status = isKnownError ? err.status : undefined;
	const message = errorMessageOf(err);
	const failureJson = JSON.stringify(
		{ ok: false, error: { code, message, status } },
		null,
		2,
	);
	process.stderr.write(`${failureJson}\n`);
};
