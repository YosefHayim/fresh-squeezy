import { freshSqueezyErrorOf } from "@/core/errors.js";
import type { HttpClient } from "@/core/http.js";
import {
	type ResourceVerbSpec,
	findResourceVerb,
	invokeOp,
} from "@/resources/registry.js";

export interface BulkTarget {
	id: string;
	label: string;
}

interface BulkResult extends BulkTarget {
	ok: boolean;
	error?: string;
}

export interface BulkSummary {
	dryRun: boolean;
	total: number;
	succeeded: number;
	failed: number;
	results: BulkResult[];
}

export interface BulkSelector {
	all?: boolean;
	ids?: string[];
	match?: string;
	storeId?: string;
	parentId?: string;
}

export const supportsBulk = (spec: ResourceVerbSpec): boolean =>
	Boolean(spec.destructive) && spec.idRole === "id";

const describeBulkTarget = (item: {
	id: string | number;
	attributes?: Record<string, unknown>;
}): BulkTarget => {
	const attrs = item.attributes ?? {};
	const id = String(item.id);
	for (const key of [
		"code",
		"name",
		"url",
		"identifier",
		"user_email",
		"status",
	]) {
		const value = attrs[key];
		if (typeof value === "string" && value.length > 0)
			return { id, label: value };
	}
	return { id, label: id };
};

const matchesText = (
	item: { attributes?: Record<string, unknown> },
	text: string,
): boolean => {
	const needle = text.toLowerCase();
	return Object.values(item.attributes ?? {}).some(
		(value) =>
			typeof value === "string" && value.toLowerCase().includes(needle),
	);
};

export const collectBulkTargets = async (
	http: HttpClient,
	spec: ResourceVerbSpec,
	selector: BulkSelector,
): Promise<BulkTarget[]> => {
	if (selector.ids?.length) {
		return selector.ids.map((id) => ({ id, label: id }));
	}

	const listSpec = findResourceVerb(spec.resource, "list");
	if (!listSpec) {
		throw freshSqueezyErrorOf({
			code: "UNKNOWN_OP",
			message: `Cannot use --all: ${spec.resource} has no list op. Pass --ids instead.`,
		});
	}
	if (listSpec.idRole === "store" && !selector.storeId) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message:
				"--all needs a store: pass --store-ids or set LEMON_SQUEEZY_STORE_ID.",
		});
	}
	if (listSpec.idRole === "parent" && !selector.parentId) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: `--all needs --parent-id to list ${spec.resource} items.`,
		});
	}

	const items = (await invokeOp(http, spec.resource, "list", {
		storeId: selector.storeId,
		parentId: selector.parentId,
	})) as Array<{ id: string | number; attributes?: Record<string, unknown> }>;

	return items
		.filter((item) =>
			selector.match ? matchesText(item, selector.match) : true,
		)
		.map(describeBulkTarget);
};

export const executeBulk = async (
	http: HttpClient,
	spec: ResourceVerbSpec,
	targets: BulkTarget[],
	opts: { dryRun?: boolean; body?: unknown } = {},
): Promise<BulkSummary> => {
	const dryRun = Boolean(opts.dryRun);
	const results: BulkResult[] = [];
	for (const target of targets) {
		if (dryRun) {
			results.push({ ...target, ok: true });
			continue;
		}
		try {
			await invokeOp(http, spec.resource, spec.verb, {
				id: target.id,
				body: opts.body,
			});
			results.push({ ...target, ok: true });
		} catch (err) {
			results.push({
				...target,
				ok: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
	const failed = results.filter((r) => !r.ok).length;
	return {
		dryRun,
		total: results.length,
		succeeded: results.length - failed,
		failed,
		results,
	};
};

export const previewTargets = (targets: BulkTarget[], max = 5): string => {
	const shown = targets.slice(0, max).map((t) => t.label);
	const more = targets.length - shown.length;
	return more > 0 ? `${shown.join(", ")}, … +${more} more` : shown.join(", ");
};

export const renderBulkSummary = (
	spec: ResourceVerbSpec,
	summary: BulkSummary,
): string => {
	if (summary.total === 0)
		return `No ${spec.resource} items matched — nothing to ${spec.verb}.\n`;
	const verb = summary.dryRun ? `would ${spec.verb}` : spec.verb;
	const lines = summary.results.map((r) =>
		r.ok
			? `  ✓ ${verb} ${spec.resource} ${r.id} (${r.label})`
			: `  ✗ ${spec.verb} ${spec.resource} ${r.id} (${r.label}): ${r.error}`,
	);
	const tail = summary.dryRun
		? `dry run — ${summary.total} ${spec.resource} item(s) would be affected, nothing sent`
		: `${summary.succeeded}/${summary.total} succeeded${summary.failed ? `, ${summary.failed} failed` : ""}`;
	return `${lines.join("\n")}\n${tail}\n`;
};
