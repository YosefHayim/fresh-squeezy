import { resolveConfig } from "../../core/config.js";
import { FreshSqueezyError } from "../../core/errors.js";
import { HttpClient } from "../../core/http.js";
import type { Mode } from "../../core/types.js";
import { createFreshSqueezy } from "../../createFreshSqueezy.js";
import { findResourceVerb, resourceRegistry } from "../../resources/registry.js";
import { renderCliError } from "../errors.js";
import {
  type ManageOperationChoice,
  askParentId,
  confirmResourceOp,
  isPromptCancel,
  pickBulkTargets,
  pickManageOperation,
} from "../prompts.js";
import { resolveStores } from "../resolveStores.js";
import {
  type BulkTarget,
  collectBulkTargets,
  executeBulk,
  previewTargets,
  renderBulkSummary,
  supportsBulk,
} from "./bulkOps.js";

/**
 * Operations the menu offers: every destructive, id-based registry op that also
 * has a `list` to enumerate from.
 *
 * @returns Resource/verb pairs in registry order.
 */
export const listManageOperations = (): ManageOperationChoice[] =>
  resourceRegistry
    .filter((spec) => supportsBulk(spec) && findResourceVerb(spec.resource, "list"))
    .map((spec) => ({ resource: spec.resource, verb: spec.verb }));

/**
 * Build the flag-driven command that reproduces an interactive selection, so
 * the menu teaches the scriptable form.
 *
 * @param input - What was chosen and where.
 * @returns A copy/paste `fresh-squeezy …` command.
 *
 * @example
 * ```ts
 * renderEquivalentCommand({ verb: "delete", resource: "discount", mode: "test",
 *   storeId: "1", picked: ["7"], total: 3 });
 * // fresh-squeezy delete discount --ids 7 --yes
 * ```
 */
export const renderEquivalentCommand = (input: {
  verb: string;
  resource: string;
  mode: Mode;
  storeId?: string;
  parentId?: string;
  picked: string[];
  total: number;
}): string => {
  const parts = ["fresh-squeezy", input.verb, input.resource];
  if (input.picked.length === input.total) {
    parts.push("--all");
    if (input.storeId) parts.push("--store-ids", input.storeId);
    if (input.parentId) parts.push("--parent-id", input.parentId);
  } else {
    parts.push("--ids", input.picked.join(","));
  }
  parts.push("--yes");
  if (input.mode === "live") parts.push("--mode", "live");
  return parts.join(" ");
};

/**
 * Interactive "Manage resources": pick an op, a store, the items, confirm once,
 * run it through the same bulk executor the `--all` / `--ids` flags use.
 *
 * @returns 0 ok, 1 some items failed, 2 setup/API error. Prompt cancels propagate
 * to the launcher, which maps them to 130.
 *
 * @example
 * ```ts
 * const code = await runManageCommand();
 * ```
 */
export const runManageCommand = async (): Promise<number> => {
  try {
    const client = createFreshSqueezy();
    const http = new HttpClient(resolveConfig());
    const op = await pickManageOperation(listManageOperations());
    const spec = findResourceVerb(op.resource, op.verb);
    const listSpec = findResourceVerb(op.resource, "list");
    if (!spec || !listSpec) {
      throw new FreshSqueezyError({
        code: "UNKNOWN_OP",
        message: `${op.verb} ${op.resource} is not available.`,
      });
    }

    process.stdout.write(`\n${op.verb} ${op.resource} — mode=${client.mode}\n`);

    let scopes: Array<{ storeId?: string; parentId?: string }> = [{}];
    if (listSpec.idRole === "store") {
      const { storeIds } = await resolveStores(client, { isInteractive: true });
      scopes = storeIds.map((storeId) => ({ storeId }));
    } else if (listSpec.idRole === "parent") {
      scopes = [{ parentId: await askParentId(op.resource) }];
    }

    let exitCode = 0;
    for (const scope of scopes) {
      const targets = await collectBulkTargets(http, spec, { all: true, ...scope });
      if (targets.length === 0) {
        process.stdout.write(
          `No ${op.resource} items found${scope.storeId ? ` in store ${scope.storeId}` : ""}.\n`,
        );
        continue;
      }

      const pickedIds = await pickBulkTargets(op.verb, targets);
      const picked: BulkTarget[] = targets.filter((t) => pickedIds.includes(t.id));
      const mark = client.mode === "live" ? "LIVE mode: " : "";
      const go = await confirmResourceOp(
        `${mark}${op.verb} ${picked.length} ${op.resource} item(s) (${previewTargets(picked)})?`,
      );
      if (!go) {
        process.stdout.write("Skipped — nothing changed.\n");
        continue;
      }

      const summary = await executeBulk(http, spec, picked);
      process.stdout.write(renderBulkSummary(spec, summary));
      process.stdout.write(
        `\nNext time:\n  ${renderEquivalentCommand({
          verb: op.verb,
          resource: op.resource,
          mode: client.mode,
          ...scope,
          picked: pickedIds,
          total: targets.length,
        })}\n`,
      );
      if (summary.failed > 0) exitCode = 1;
    }
    return exitCode;
  } catch (err) {
    if (isPromptCancel(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(renderCliError(message, ["fresh-squeezy ops --list"]));
    return 2;
  }
};
