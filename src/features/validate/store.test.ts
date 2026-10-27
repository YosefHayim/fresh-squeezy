import { notFoundError, storeDoc } from "@e2e/fixtures/sandbox/data.js";
import { createMockFetch, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { resolveConfig } from "@/shared/config.js";
import { HttpClient } from "@/shared/http.js";
import { validateStore } from "./store.js";

const makeClient = (routes: Parameters<typeof createMockFetch>[0]) => {
	const { fetch } = createMockFetch(routes);
	return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
};

test("validateStore returns ok for reachable store", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
	]);
	const storeValidation = await validateStore(http, "test", 42);
	expect(storeValidation.ok).toBe(true);
	expect(storeValidation.resource?.slug).toBe("fresh-squeezy-test");
});

test("validateStore returns STORE_NOT_FOUND on 404", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/stores/9999"), status: 404, body: notFoundError },
	]);
	const storeValidation = await validateStore(http, "test", 9999);
	expect(storeValidation.ok).toBe(false);
	expect(storeValidation.issues[0]?.code).toBe("STORE_NOT_FOUND");
});
