import type { JsonApiResource } from "@/contracts/contracts.js";
import type { FreshSqueezyClient } from "@/create-fresh-squeezy.js";
import { freshSqueezyErrorOf } from "@/errors/errors.js";
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
	const givenStoreIds = input.storeIds ?? [];
	const areStoreIdsGiven = givenStoreIds.length > 0;
	if (areStoreIdsGiven) {
		return { storeIds: dedupe(givenStoreIds), skipped: false };
	}

	if (input.allStores) {
		const ids = await fetchNonEmptyStoreIds(client);
		return { storeIds: ids, skipped: false };
	}

	const isNonInteractive = !input.isInteractive;
	if (isNonInteractive) {
		return { storeIds: [], skipped: true };
	}

	const ids = await fetchNonEmptyStoreIds(client);
	const isThereOnlyOneStore = ids.length === 1;
	if (isThereOnlyOneStore) {
		return { storeIds: ids, skipped: false };
	}

	const storeChoices = await listStoreChoices(client);
	const picked = await pickStores(storeChoices);
	const isNoStorePicked = picked.length === 0;
	if (isNoStorePicked) {
		throw freshSqueezyErrorOf({
			code: "NO_SELECTION",
			message: "No store selected. Pick at least one to continue.",
		});
	}
	return { storeIds: picked, skipped: false };
};

const fetchNonEmptyStoreIds = async (
	client: FreshSqueezyClient,
): Promise<string[]> => {
	const ids = await fetchReachableStoreIds(client);
	const areThereNoStores = ids.length === 0;
	if (areThereNoStores) {
		throw freshSqueezyErrorOf({
			code: "NO_STORES",
			message: "No stores reachable with this API key.",
		});
	}
	return ids;
};

const fetchReachableStoreIds = async (
	client: FreshSqueezyClient,
): Promise<string[]> => {
	const connection = await client.validateConnection();
	const authIssue = connection.issues.find(
		(entry) => entry.code === "AUTH_FAILED",
	);
	const isAuthFailure = !connection.ok && Boolean(authIssue);
	if (isAuthFailure) {
		throw freshSqueezyErrorOf({
			code: "AUTH_FAILED",
			message: authIssue?.message ?? "",
		});
	}
	return connection.resource?.storeIds ?? [];
};

const dedupe = (values: string[]): string[] => {
	const trimmedValues = values.map((value) => value.trim());
	const nonEmptyValues = trimmedValues.filter(Boolean);
	const uniqueValues = new Set(nonEmptyValues);
	return Array.from(uniqueValues);
};
