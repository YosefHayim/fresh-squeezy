import { readFileSync } from "node:fs";
import { resolveConfig } from "@/core/config.js";
import { freshSqueezyErrorOf, isFreshSqueezyError } from "@/core/errors.js";
import { HttpClient } from "@/core/http.js";
import type { Mode } from "@/core/types.js";
import {
	type OpVerb,
	findResourceVerb,
	invokeOp,
	listRegisteredResources,
	resourceRegistry,
} from "@/resources/registry.js";
import { confirmResourceOp } from "@/cli/prompts.js";
import { renderCliError } from "@/cli/render.js";
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
	if (options.listCatalog) {
		writeCatalog(options.json ?? false);
		return 0;
	}

	const spec = findResourceVerb(options.resource, options.verb);
	if (!spec) {
		process.stderr.write(
			renderCliError(
				`Unknown or unsupported op: ${options.verb} ${options.resource}`,
				[
					"fresh-squeezy ops --list",
					"fresh-squeezy get product --id 1",
					"fresh-squeezy list webhook --store-ids 1",
				],
			),
		);
		return 2;
	}

	const bulkError = validateBulkFlags(spec, options);
	if (bulkError) {
		writeFatal(
			freshSqueezyErrorOf({ code: "INVALID_ARGS", message: bulkError }),
			options.json ?? false,
		);
		return 2;
	}

	try {
		const body = readBody(options);
		if (spec.body === "required" && body === undefined) {
			throw freshSqueezyErrorOf({
				code: "MISSING_ARG",
				message: "This op requires a JSON body (--body or --body-file).",
			});
		}

		const config = resolveConfig({ mode: options.mode });
		const http = new HttpClient(config);
		// CLI flag wins; LEMON_SQUEEZY_STORE_ID (already in config) is the fallback.
		const storeId = options.storeIds?.[0] ?? config.storeId;

		if (options.all || options.ids) {
			return await runBulk(http, spec, config.mode, options, { storeId, body });
		}

		const allowed = await assertWriteSafety(spec, config.mode, options);
		if (!allowed) return 2;

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
			process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
		} else {
			process.stdout.write(
				`${spec.verb} ${spec.resource} — ok (mode=${config.mode})\n` +
					`${JSON.stringify(opBody ?? null, null, 2)}\n`,
			);
		}
		return 0;
	} catch (err) {
		writeFatal(err, options.json ?? false);
		return 2;
	}
};

const writeCatalog = (asJson: boolean): void => {
	if (asJson) {
		process.stdout.write(
			`${JSON.stringify(
				{
					resources: listRegisteredResources(),
					ops: resourceRegistry,
				},
				null,
				2,
			)}\n`,
		);
		return;
	}
	process.stdout.write(
		"Docs-backed ops (Lemon Squeezy official API only):\n\n",
	);
	for (const entry of resourceRegistry) {
		const flags = [
			entry.destructive ? "destructive" : undefined,
			entry.body && entry.body !== "none" ? `body=${entry.body}` : undefined,
		]
			.filter(Boolean)
			.join(", ");
		process.stdout.write(
			`  ${entry.verb.padEnd(18)} ${entry.resource.padEnd(22)} ${entry.docsPath}${flags ? `  (${flags})` : ""}\n`,
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
	const bulk = Boolean(options.all || options.ids);
	if (!bulk) {
		if (options.match) return "--match needs --all.";
		if (options.dryRun) return "--dry-run needs --all or --ids.";
		return undefined;
	}
	if (!supportsBulk(spec)) {
		return `--all/--ids only apply to delete, cancel, and refund ops (not ${spec.verb} ${spec.resource}).`;
	}
	if (options.all && options.ids) return "Use either --all or --ids, not both.";
	if (options.id)
		return "--id targets one resource; drop it when using --all or --ids.";
	if (options.match && !options.all) return "--match needs --all.";
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

	if (!options.dryRun && targets.length > 0) {
		const allowed = await assertWriteSafety(spec, mode, options, {
			count: targets.length,
			preview: previewTargets(targets),
		});
		if (!allowed) return 2;
	}

	const summary = await executeBulk(http, spec, targets, {
		dryRun: options.dryRun,
		body: scope.body,
	});

	if (options.json) {
		const envelope = {
			ok: summary.failed === 0,
			mode,
			resource: spec.resource,
			verb: spec.verb,
			docs: `https://docs.lemonsqueezy.com/api/${spec.docsPath}`,
			...summary,
		};
		process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
	} else {
		process.stdout.write(`${spec.verb} ${spec.resource} (mode=${mode})\n`);
		process.stdout.write(renderBulkSummary(spec, summary));
	}
	return summary.failed > 0 ? 1 : 0;
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
	if (!isWrite) return true;

	const needsGate = Boolean(spec.destructive) || mode === "live";
	if (!needsGate) return true;

	if (options.yes) return true;

	if (options.isInteractive) {
		const what = bulk
			? `${spec.verb} ${bulk.count} ${spec.resource} item(s) (${bulk.preview})`
			: `${spec.verb} ${spec.resource}`;
		return confirmResourceOp(
			mode === "live" ? `LIVE mode: allow ${what}?` : `Confirm ${what}?`,
		);
	}

	process.stderr.write(
		renderCliError(
			`${spec.verb} ${spec.resource} requires --yes in non-interactive ${mode} mode${spec.destructive ? " (destructive op)" : ""}`,
			[
				`fresh-squeezy ${spec.verb} ${spec.resource}${bulk ? " --all" : ""} --yes …`,
				"Use test mode for safer experimentation: --mode test",
			],
		),
	);
	return false;
};

const readBody = (options: ResourceOpCommandOptions): unknown | undefined => {
	// Bodies come from flags only — never auto-read stdin (would hang non-TTY pipes).
	if (options.bodyFile) {
		return JSON.parse(readFileSync(options.bodyFile, "utf8")) as unknown;
	}
	if (options.body !== undefined) {
		return JSON.parse(options.body) as unknown;
	}
	return undefined;
};

const writeFatal = (err: unknown, json: boolean): void => {
	if (json) {
		const code = isFreshSqueezyError(err) ? err.code : "FATAL";
		const message = err instanceof Error ? err.message : String(err);
		const status = isFreshSqueezyError(err) ? err.status : undefined;
		process.stderr.write(
			`${JSON.stringify({ ok: false, error: { code, message, status } }, null, 2)}\n`,
		);
		return;
	}
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(renderCliError(message, ["fresh-squeezy ops --list"]));
};
