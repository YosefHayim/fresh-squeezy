import { freshSqueezyErrorOf } from "@/core/errors.js";
import type { JsonApiResource } from "@/core/types.js";
import type { FreshSqueezyClient } from "@/createFreshSqueezy.js";
import type { StoreAttributes } from "@/resources/attributes.js";
import { pickStores } from "./prompts.js";

export interface ResolveStoresInput {
	storeIds?: string[];
	allStores?: boolean;
	isInteractive: boolean;
}

export interface ResolveStoresOutput {
	storeIds: string[];
	skipped: boolean;
}

export interface StoreChoice {
	id: string;
	name: string;
	slug: string;
}

export const listStoreChoices = async (
	client: FreshSqueezyClient,
): Promise<StoreChoice[]> => {
	const stores =
		(await client.stores.list()) as JsonApiResource<StoreAttributes>[];
	return stores.map((store) => ({
		id: store.id,
		name: store.attributes.name,
		slug: store.attributes.slug,
	}));
};

export const resolveStores = async (
	client: FreshSqueezyClient,
	input: ResolveStoresInput,
): Promise<ResolveStoresOutput> => {
	if (input.storeIds && input.storeIds.length > 0) {
		return { storeIds: dedupe(input.storeIds), skipped: false };
	}

	if (input.allStores) {
		const ids = await fetchReachableStoreIds(client);
		if (ids.length === 0) {
			throw freshSqueezyErrorOf({
				code: "NO_STORES",
				message: "No stores reachable with this API key.",
			});
		}
		return { storeIds: ids, skipped: false };
	}

	if (!input.isInteractive) {
		return { storeIds: [], skipped: true };
	}

	const ids = await fetchReachableStoreIds(client);
	if (ids.length === 0) {
		throw freshSqueezyErrorOf({
			code: "NO_STORES",
			message: "No stores reachable with this API key.",
		});
	}
	if (ids.length === 1) {
		return { storeIds: ids, skipped: false };
	}

	const picked = await pickStores(await listStoreChoices(client));
	if (picked.length === 0) {
		throw freshSqueezyErrorOf({
			code: "NO_SELECTION",
			message: "No store selected. Pick at least one to continue.",
		});
	}
	return { storeIds: picked, skipped: false };
};

const fetchReachableStoreIds = async (
	client: FreshSqueezyClient,
): Promise<string[]> => {
	const connection = await client.validateConnection();
	if (!connection.ok) {
		const authIssue = connection.issues.find(
			(entry) => entry.code === "AUTH_FAILED",
		);
		if (authIssue) {
			throw freshSqueezyErrorOf({
				code: "AUTH_FAILED",
				message: authIssue.message,
			});
		}
	}
	return connection.resource?.storeIds ?? [];
};

const dedupe = (values: string[]): string[] => {
	return Array.from(
		new Set(values.map((value) => value.trim()).filter(Boolean)),
	);
};
