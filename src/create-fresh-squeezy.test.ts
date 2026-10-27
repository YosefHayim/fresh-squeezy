import { STORE_DOC } from "@e2e/sandbox-store.js";
import { createMockFetch, route, SIGNED_IN_ROUTES } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { createFreshSqueezy } from "./create-fresh-squeezy.js";

const freshSqueezyOf = (storeId?: string) => {
	const routes = [...SIGNED_IN_ROUTES, route("/v1/stores/42", STORE_DOC)];
	const { fetch, calls } = createMockFetch(routes);
	const freshSqueezy = createFreshSqueezy({ apiKey: "k", storeId, fetch });
	return { freshSqueezy, calls };
};

test("createFreshSqueezy exposes the configured mode", () => {
	const { freshSqueezy } = freshSqueezyOf();

	expect(freshSqueezy.mode).toBe("test");
});

test("validateConnection reaches the API with the configured key", async () => {
	const { freshSqueezy } = freshSqueezyOf();

	const connection = await freshSqueezy.validateConnection();

	expect(connection.ok).toBe(true);
});

test("validateStore checks the store id it is given", async () => {
	const { freshSqueezy } = freshSqueezyOf();

	const storeValidation = await freshSqueezy.validateStore("42");

	expect(storeValidation.ok).toBe(true);
});

test("listStoreIds returns the configured store without calling the API", async () => {
	const { freshSqueezy, calls } = freshSqueezyOf("42");

	const storeIds = await freshSqueezy.listStoreIds();

	expect(storeIds).toEqual(["42"]);
	expect(calls).toHaveLength(0);
});

test("listStoreIds lists every store when none is configured", async () => {
	const { freshSqueezy } = freshSqueezyOf();

	const storeIds = await freshSqueezy.listStoreIds();

	expect(storeIds).toEqual(["42"]);
});

test("doctor checks the configured store", async () => {
	const { freshSqueezy } = freshSqueezyOf("42");

	const report = await freshSqueezy.doctor();

	expect(report.results.map((entry) => entry.name)).toEqual([
		"connection",
		"store",
	]);
});

test("doctor lets the options override the configured store", async () => {
	const { freshSqueezy, calls } = freshSqueezyOf("1");

	await freshSqueezy.doctor({ storeId: "42" });

	expect(calls.some((entry) => entry.url.includes("/v1/stores/42"))).toBe(true);
});

test("the check methods are all present", () => {
	const { freshSqueezy } = freshSqueezyOf();

	expect(typeof freshSqueezy.validateProduct).toBe("function");
	expect(typeof freshSqueezy.validateWebhook).toBe("function");
	expect(typeof freshSqueezy.validateDiscount).toBe("function");
	expect(typeof freshSqueezy.validateLicenseKey).toBe("function");
	expect(typeof freshSqueezy.validateSubscriptionPlan).toBe("function");
});

test("the client verbs share the configured key and fetch", async () => {
	const { freshSqueezy, calls } = freshSqueezyOf();

	await freshSqueezy.get("stores", "42");

	expect(calls[0]?.url).toContain("/v1/stores/42");
});
