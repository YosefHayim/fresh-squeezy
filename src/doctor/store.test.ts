import { makeHttp, route } from "@e2e/mock-fetch.js";
import { NOT_FOUND_ERROR, STORE_DOCUMENT } from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { validateStore } from "./store.js";

describe("validateStore", () => {
	test("returns ok for a reachable store", async () => {
		const http = makeHttp([route("/v1/stores/42", STORE_DOCUMENT)]);

		const storeReport = await validateStore(http, "test", "42");

		expect(storeReport.ok).toBe(true);
		expect(storeReport.resource?.slug).toBe("fresh-squeezy-test");
		expect(storeReport.target?.id).toBe("42");
	});

	test("returns STORE_NOT_FOUND on a 404", async () => {
		const http = makeHttp([route("/v1/stores/9999", NOT_FOUND_ERROR, 404)]);

		const storeReport = await validateStore(http, "test", "9999");

		expect(storeReport.ok).toBe(false);
		expect(storeReport.findings[0]?.code).toBe("STORE_NOT_FOUND");
		expect(storeReport.findings[0]?.context).toEqual({ storeId: "9999" });
		expect(storeReport.target?.label).toBe("store 9999");
	});
});
