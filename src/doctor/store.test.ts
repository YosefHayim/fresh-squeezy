import { NOT_FOUND_ERROR, STORE_DOC } from "@e2e/sandbox-store.js";
import { makeHttp, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateStore } from "./store.js";

test("validateStore returns ok for reachable store", async () => {
	const http = makeHttp([
		{ match: pathIs("/v1/stores/42"), status: 200, body: STORE_DOC },
	]);
	const storeValidation = await validateStore(http, "test", "42");
	expect(storeValidation.ok).toBe(true);
	expect(storeValidation.resource?.slug).toBe("fresh-squeezy-test");
});

test("validateStore returns STORE_NOT_FOUND on 404", async () => {
	const http = makeHttp([
		{ match: pathIs("/v1/stores/9999"), status: 404, body: NOT_FOUND_ERROR },
	]);
	const storeValidation = await validateStore(http, "test", "9999");
	expect(storeValidation.ok).toBe(false);
	expect(storeValidation.findings[0]?.code).toBe("STORE_NOT_FOUND");
});
