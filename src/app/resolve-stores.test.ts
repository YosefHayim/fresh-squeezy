import { expect, test, vi } from "vitest";
import type { FreshSqueezyClient } from "@/create-fresh-squeezy.js";
import { resolveStores } from "./resolve-stores.js";

const connectionWithStores = (storeIds: string[]) =>
	vi.fn().mockResolvedValue({
		ok: true,
		mode: "test",
		name: "connection",
		issues: [],
		resource: { user: {}, storeCount: storeIds.length, storeIds },
	});

const stubClient = (
	overrides: Partial<FreshSqueezyClient>,
): FreshSqueezyClient => {
	return {
		mode: "test",
		request: vi.fn(),
		validateConnection: vi.fn(),
		validateStore: vi.fn(),
		validateProduct: vi.fn(),
		validateWebhook: vi.fn(),
		doctor: vi.fn(),
		...overrides,
	} as FreshSqueezyClient;
};

test("resolveStores prefers --store-ids over anything else", async () => {
	const client = stubClient({});
	const resolvedStores = await resolveStores(client, {
		storeIds: ["1", "2", "1"],
		isInteractive: true,
	});
	expect(resolvedStores).toEqual({ storeIds: ["1", "2"], skipped: false });
});

test("resolveStores fetches every reachable store when --all-stores is set", async () => {
	const client = stubClient({
		validateConnection: connectionWithStores(["10", "11"]),
	});
	const resolvedStores = await resolveStores(client, {
		allStores: true,
		isInteractive: false,
	});
	expect(resolvedStores.storeIds).toEqual(["10", "11"]);
	expect(resolvedStores.skipped).toBe(false);
});

test("resolveStores returns skipped=true when non-interactive and no flags", async () => {
	const client = stubClient({});
	const resolvedStores = await resolveStores(client, { isInteractive: false });
	expect(resolvedStores).toEqual({ storeIds: [], skipped: true });
});

test("resolveStores throws NO_STORES when --all-stores is set but account has none", async () => {
	const client = stubClient({
		validateConnection: connectionWithStores([]),
	});
	await expect(
		resolveStores(client, { allStores: true, isInteractive: false }),
	).rejects.toMatchObject({
		code: "NO_STORES",
	});
});
