import { createMockFetch, route, SIGNED_IN_ROUTES } from "@e2e/mock-fetch.js";
import { STORE_DOC } from "@e2e/sandbox-store.js";
import { expect, test } from "vitest";
import { createFreshSqueezy } from "./create-fresh-squeezy.js";

const buildTestFreshSqueezy = (storeId?: string) => {
	const routes = [...SIGNED_IN_ROUTES, route("/v1/stores/42", STORE_DOC)];
	const { fetch, calls } = createMockFetch(routes);
	const freshSqueezy = createFreshSqueezy({ apiKey: "k", storeId, fetch });
	return { freshSqueezy, calls };
};

test("createFreshSqueezy exposes the configured mode", () => {
	const { freshSqueezy } = buildTestFreshSqueezy();

	expect(freshSqueezy.mode).toBe("test");
});

test("validateConnection reaches the API with the configured key", async () => {
	const { freshSqueezy } = buildTestFreshSqueezy();

	const connection = await freshSqueezy.validateConnection();

	expect(connection.ok).toBe(true);
});

test("validateStore checks the store id it is given", async () => {
	const { freshSqueezy } = buildTestFreshSqueezy();

	const storeValidation = await freshSqueezy.validateStore("42");

	expect(storeValidation.ok).toBe(true);
});

test("listStoreIds returns the configured store without calling the API", async () => {
	const { freshSqueezy, calls } = buildTestFreshSqueezy("42");

	const storeIds = await freshSqueezy.listStoreIds();

	expect(storeIds).toEqual(["42"]);
	expect(calls).toHaveLength(0);
});

test("listStoreIds lists every store when none is configured", async () => {
	const { freshSqueezy } = buildTestFreshSqueezy();

	const storeIds = await freshSqueezy.listStoreIds();

	expect(storeIds).toEqual(["42"]);
});

test("doctor checks the configured store", async () => {
	const { freshSqueezy } = buildTestFreshSqueezy("42");

	const report = await freshSqueezy.doctor();

	expect(report.checks.map((check) => check.name)).toEqual([
		"connection",
		"store",
	]);
});

test("doctor lets the options override the configured store", async () => {
	const { freshSqueezy, calls } = buildTestFreshSqueezy("1");

	await freshSqueezy.doctor({ storeId: "42" });

	expect(calls.some((check) => check.url.includes("/v1/stores/42"))).toBe(true);
});

test("the check methods are all present", () => {
	const { freshSqueezy } = buildTestFreshSqueezy();

	expect(typeof freshSqueezy.validateProduct).toBe("function");
	expect(typeof freshSqueezy.validateWebhook).toBe("function");
	expect(typeof freshSqueezy.validateDiscount).toBe("function");
	expect(typeof freshSqueezy.validateLicenseKey).toBe("function");
	expect(typeof freshSqueezy.validateSubscriptionPlan).toBe("function");
});

test("the client verbs share the configured key and fetch", async () => {
	const { freshSqueezy, calls } = buildTestFreshSqueezy();

	await freshSqueezy.get("stores", "42");

	expect(calls[0]?.url).toContain("/v1/stores/42");
});
