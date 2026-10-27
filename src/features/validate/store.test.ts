import { notFoundError, storeDoc } from "@e2e/fixtures/sandbox/data.js";
import { makeClient, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateStore } from "./store.js";

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
