import { FreshSqueezyError } from "../../core/errors.js";
import type { HttpClient } from "../../core/http.js";
import { invokeOp } from "../../resources/invokeOp.js";
import { type ResourceVerbSpec, findResourceVerb } from "../../resources/registry.js";

/** One resource the bulk run will act on. */
export interface BulkTarget {
  id: string;
  /** Human label (code, name, url) shown in confirms and results. */
  label: string;
}

/** Per-item outcome of a bulk run. */
interface BulkResult extends BulkTarget {
  ok: boolean;
  error?: string;
}

/** Aggregate outcome of a bulk run. */
export interface BulkSummary {
  dryRun: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: BulkResult[];
}

/** Selector flags that choose which resources a bulk run touches. */
export interface BulkSelector {
  all?: boolean;
  ids?: string[];
  match?: string;
  storeId?: string;
  parentId?: string;
}

/**
 * Whether a registry spec can run in bulk: write verbs that act on one id
 * (delete / cancel / refund) and have a matching `list` to enumerate from.
 *
 * @param spec - Registry entry for the verb.
 * @returns True when `--all` / `--ids` make sense for this op.
 */
export const supportsBulk = (spec: ResourceVerbSpec): boolean =>
  Boolean(spec.destructive) && spec.idRole === "id";

/**
 * Pick a readable label from a JSON:API resource (code, name, url, …).
 *
 * @param item - Resource returned by `list`.
 * @returns The best label, falling back to the id.
 */
const describeBulkTarget = (item: {
  id: string | number;
  attributes?: Record<string, unknown>;
}): BulkTarget => {
  const attrs = item.attributes ?? {};
  const id = String(item.id);
  for (const key of ["code", "name", "url", "identifier", "user_email", "status"]) {
    const value = attrs[key];
    if (typeof value === "string" && value.length > 0) return { id, label: value };
  }
  return { id, label: id };
};

/**
 * Case-insensitive substring match against every string attribute.
 */
const matchesText = (item: { attributes?: Record<string, unknown> }, text: string): boolean => {
  const needle = text.toLowerCase();
  return Object.values(item.attributes ?? {}).some(
    (value) => typeof value === "string" && value.toLowerCase().includes(needle),
  );
};

/**
 * Resolve the targets of a bulk run: explicit `--ids`, or every item from the
 * resource's `list` (all pages), optionally narrowed by `--match`.
 *
 * @param http - Shared API client.
 * @param spec - Registry entry for the write verb.
 * @param selector - Which resources to touch, plus the list scope.
 * @returns Targets in API order.
 * @throws {FreshSqueezyError} `MISSING_ARG` when list scope is missing, `UNKNOWN_OP` without a list op.
 *
 * @example
 * ```ts
 * const targets = await collectBulkTargets(http, spec, { all: true, storeId: "1" });
 * ```
 */
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
    throw new FreshSqueezyError({
      code: "UNKNOWN_OP",
      message: `Cannot use --all: ${spec.resource} has no list op. Pass --ids instead.`,
    });
  }
  if (listSpec.idRole === "store" && !selector.storeId) {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: "--all needs a store: pass --store-ids or set LEMON_SQUEEZY_STORE_ID.",
    });
  }
  if (listSpec.idRole === "parent" && !selector.parentId) {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: `--all needs --parent-id to list ${spec.resource} items.`,
    });
  }

  const items = (await invokeOp(http, spec.resource, "list", {
    storeId: selector.storeId,
    parentId: selector.parentId,
  })) as Array<{ id: string | number; attributes?: Record<string, unknown> }>;

  return items
    .filter((item) => (selector.match ? matchesText(item, selector.match) : true))
    .map(describeBulkTarget);
};

/**
 * Apply the write verb to each target. Keeps going after a failure so one bad
 * id never blocks the rest; with `dryRun` nothing is sent.
 *
 * @param http - Shared API client.
 * @param spec - Registry entry for the write verb.
 * @param targets - Resources to act on.
 * @param opts - `dryRun` skips writes; `body` is forwarded to every call.
 * @returns Per-item results and totals.
 *
 * @example
 * ```ts
 * const summary = await executeBulk(http, spec, targets, { dryRun: false });
 * if (summary.failed > 0) process.exitCode = 1;
 * ```
 */
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
      await invokeOp(http, spec.resource, spec.verb, { id: target.id, body: opts.body });
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
  return { dryRun, total: results.length, succeeded: results.length - failed, failed, results };
};

/**
 * Short preview of target labels for confirm prompts.
 *
 * @param targets - Resources about to be touched.
 * @param max - Labels to show before eliding.
 */
export const previewTargets = (targets: BulkTarget[], max = 5): string => {
  const shown = targets.slice(0, max).map((t) => t.label);
  const more = targets.length - shown.length;
  return more > 0 ? `${shown.join(", ")}, … +${more} more` : shown.join(", ");
};

/**
 * Render a bulk summary for terminal output.
 *
 * @param spec - Registry entry for the write verb.
 * @param summary - Result of `executeBulk`.
 */
export const renderBulkSummary = (spec: ResourceVerbSpec, summary: BulkSummary): string => {
  if (summary.total === 0) return `No ${spec.resource} items matched — nothing to ${spec.verb}.\n`;
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
