import { errorMessageOf } from "@/app/render.js";
import {
	findResourceVerb,
	invokeOp,
	type ResourceVerbSpec,
} from "@/features/ops/resource-registry.js";
import { freshSqueezyErrorOf } from "@/shared/errors.js";
import type { HttpClient } from "@/shared/http.js";

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
	ids?: string[];
	match?: string;
	storeId?: string;
	parentId?: string;
}

interface ListedItem {
	id: string | number;
	attributes?: Record<string, unknown>;
}

export const supportsBulk = (spec: ResourceVerbSpec): boolean =>
	Boolean(spec.destructive) && spec.idRole === "id";

const describeBulkTarget = (item: ListedItem): BulkTarget => {
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
		const isLabelText = typeof value === "string" && value.length > 0;
		if (isLabelText) return { id, label: value };
	}
	return { id, label: id };
};

const matchesText = (item: ListedItem, text: string): boolean => {
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
	const { ids } = selector;
	const hasExplicitIds = ids !== undefined && ids.length > 0;
	if (hasExplicitIds) return ids.map((id) => ({ id, label: id }));

	const listSpec = findResourceVerb(spec.resource, "list");
	const hasNoListOp = !listSpec;
	if (hasNoListOp) {
		throw freshSqueezyErrorOf({
			code: "UNKNOWN_OP",
			message: `Cannot use --all: ${spec.resource} has no list op. Pass --ids instead.`,
		});
	}
	const needsStore = listSpec.idRole === "store" && !selector.storeId;
	if (needsStore) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message:
				"--all needs a store: pass --store-ids or set LEMON_SQUEEZY_STORE_ID.",
		});
	}
	const needsParent = listSpec.idRole === "parent" && !selector.parentId;
	if (needsParent) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: `--all needs --parent-id to list ${spec.resource} items.`,
		});
	}

	const listedItems = await invokeOp(http, spec.resource, "list", {
		storeId: selector.storeId,
		parentId: selector.parentId,
	});
	const items = listedItems as ListedItem[];

	const matchingItems = items.filter((item) =>
		selector.match ? matchesText(item, selector.match) : true,
	);
	return matchingItems.map(describeBulkTarget);
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
				error: errorMessageOf(err),
			});
		}
	}
	const failed = results.filter((outcome) => !outcome.ok).length;
	return {
		dryRun,
		total: results.length,
		succeeded: results.length - failed,
		failed,
		results,
	};
};

export const previewTargets = (targets: BulkTarget[], max = 5): string => {
	const shown = targets.slice(0, max).map((target) => target.label);
	const more = targets.length - shown.length;
	const hasHiddenTargets = more > 0;
	return hasHiddenTargets
		? `${shown.join(", ")}, … +${more} more`
		: shown.join(", ");
};

export const renderBulkSummary = (
	spec: ResourceVerbSpec,
	summary: BulkSummary,
): string => {
	const isThereNothingMatched = summary.total === 0;
	if (isThereNothingMatched)
		return `No ${spec.resource} items matched — nothing to ${spec.verb}.\n`;
	const verb = summary.dryRun ? `would ${spec.verb}` : spec.verb;
	const lines = summary.results.map((outcome) =>
		outcome.ok
			? `  ✓ ${verb} ${spec.resource} ${outcome.id} (${outcome.label})`
			: `  ✗ ${spec.verb} ${spec.resource} ${outcome.id} (${outcome.label}): ${outcome.error}`,
	);
	const tail = summary.dryRun
		? `dry run — ${summary.total} ${spec.resource} item(s) would be affected, nothing sent`
		: `${summary.succeeded}/${summary.total} succeeded${summary.failed ? `, ${summary.failed} failed` : ""}`;
	return `${lines.join("\n")}\n${tail}\n`;
};
