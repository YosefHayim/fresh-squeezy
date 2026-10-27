import { resolveConfig } from "@/shared/config.js";
import { freshSqueezyErrorOf } from "@/errors/errors.js";
import { HttpClient } from "@/http/http.js";
import type { Mode } from "@/contracts/contracts.js";
import {
	type FreshSqueezyClient,
	createFreshSqueezy,
} from "@/create-fresh-squeezy.js";
import { findResourceVerb, resourceRegistry } from "@/resources/registry.js";
import {
	type ManageOperationChoice,
	askParentId,
	confirmResourceOp,
	isPromptCancel,
	pickBulkTargets,
	pickManageOperation,
} from "@/cli/prompts.js";
import { renderCliError } from "@/cli/render.js";
import { resolveStores } from "@/cli/resolve-stores.js";
import {
	type BulkTarget,
	collectBulkTargets,
	executeBulk,
	previewTargets,
	renderBulkSummary,
	supportsBulk,
} from "./bulk-ops.js";

export const listManageOperations = (): ManageOperationChoice[] => {
	const isManageable = (spec: (typeof resourceRegistry)[number]): boolean => {
		const listVerb = findResourceVerb(spec.resource, "list");
		const hasListVerb = Boolean(listVerb);
		return supportsBulk(spec) && hasListVerb;
	};
	const manageableSpecs = resourceRegistry.filter(isManageable);
	return manageableSpecs.map((spec) => ({
		resource: spec.resource,
		verb: spec.verb,
	}));
};

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
	const isEverythingPicked = input.picked.length === input.total;
	if (isEverythingPicked) parts.push("--all");
	if (isEverythingPicked && input.storeId) {
		parts.push("--store-ids", input.storeId);
	}
	if (isEverythingPicked && input.parentId) {
		parts.push("--parent-id", input.parentId);
	}
	const pickedIdList = input.picked.join(",");
	if (!isEverythingPicked) parts.push("--ids", pickedIdList);
	parts.push("--yes");
	const isLive = input.mode === "live";
	if (isLive) parts.push("--mode", "live");
	return parts.join(" ");
};

type ManageScope = { storeId?: string; parentId?: string };

const pickScopes = async (
	client: FreshSqueezyClient,
	resource: string,
	idRole: string | undefined,
): Promise<ManageScope[]> => {
	const isStoreScoped = idRole === "store";
	const isParentScoped = idRole === "parent";
	if (isStoreScoped) {
		const { storeIds } = await resolveStores(client, { isInteractive: true });
		return storeIds.map((storeId) => ({ storeId }));
	}
	if (isParentScoped) {
		const parentId = await askParentId(resource);
		return [{ parentId }];
	}
	return [{}];
};

export const runManageCommand = async (): Promise<number> => {
	try {
		const client = createFreshSqueezy();
		const config = resolveConfig();
		const http = new HttpClient(config);
		const manageOperations = listManageOperations();
		const op = await pickManageOperation(manageOperations);
		const spec = findResourceVerb(op.resource, op.verb);
		const listSpec = findResourceVerb(op.resource, "list");
		const isOperationUnavailable = !spec || !listSpec;
		if (isOperationUnavailable) {
			throw freshSqueezyErrorOf({
				code: "UNKNOWN_OP",
				message: `${op.verb} ${op.resource} is not available.`,
			});
		}

		process.stdout.write(`\n${op.verb} ${op.resource} — mode=${client.mode}\n`);

		const scopes = await pickScopes(client, op.resource, listSpec.idRole);
		const isLive = client.mode === "live";
		const liveMark = isLive ? "LIVE mode: " : "";

		let exitCode = 0;
		for (const scope of scopes) {
			const targets = await collectBulkTargets(http, spec, {
				all: true,
				...scope,
			});
			const areThereNoTargets = targets.length === 0;
			if (areThereNoTargets) {
				const storeNote = scope.storeId ? ` in store ${scope.storeId}` : "";
				process.stdout.write(`No ${op.resource} items found${storeNote}.\n`);
				continue;
			}

			const pickedIds = await pickBulkTargets(op.verb, targets);
			const picked: BulkTarget[] = targets.filter((target) =>
				pickedIds.includes(target.id),
			);
			const preview = previewTargets(picked);
			const isConfirmed = await confirmResourceOp(
				`${liveMark}${op.verb} ${picked.length} ${op.resource} item(s) (${preview})?`,
			);
			const isDeclined = !isConfirmed;
			if (isDeclined) {
				process.stdout.write("Skipped — nothing changed.\n");
				continue;
			}

			const summary = await executeBulk(http, spec, picked);
			const summaryText = renderBulkSummary(spec, summary);
			process.stdout.write(summaryText);
			const equivalentCommand = renderEquivalentCommand({
				verb: op.verb,
				resource: op.resource,
				mode: client.mode,
				...scope,
				picked: pickedIds,
				total: targets.length,
			});
			process.stdout.write(`\nNext time:\n  ${equivalentCommand}\n`);
			const hasFailures = summary.failed > 0;
			if (hasFailures) exitCode = 1;
		}
		return exitCode;
	} catch (err) {
		const isCancel = isPromptCancel(err);
		if (isCancel) throw err;
		const message = err instanceof Error ? err.message : String(err);
		const errorScreen = renderCliError(message, ["fresh-squeezy ops --list"]);
		process.stderr.write(errorScreen);
		return 2;
	}
};
