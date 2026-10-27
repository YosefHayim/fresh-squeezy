import { makeHttp, route, SIGNED_IN_ROUTES } from "@e2e/mock-fetch.js";
import {
	LIVE_USER_DOCUMENT,
	UNAUTHORIZED_ERROR,
	USER_DOCUMENT,
} from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { validateConnection } from "./connection.js";

const STORES_ROUTE_ONLY = SIGNED_IN_ROUTES.slice(1);

const LIVE_ROUTES = [
	route("/v1/users/me", LIVE_USER_DOCUMENT),
	...STORES_ROUTE_ONLY,
];

describe("validateConnection", () => {
	test("returns ok when the key authenticates and stores are reachable", async () => {
		const http = makeHttp(SIGNED_IN_ROUTES);

		const connectionReport = await validateConnection(http, "test");

		expect(connectionReport.ok).toBe(true);
		expect(connectionReport.mode).toBe("test");
		expect(connectionReport.resource?.storeCount).toBe(1);
		expect(connectionReport.resource?.storeIds).toEqual(["42"]);
		expect(connectionReport.resource?.actualMode).toBe("test");
	});

	test("warns when no stores are reachable", async () => {
		const http = makeHttp([
			route("/v1/users/me", USER_DOCUMENT),
			route("/v1/stores", { data: [] }),
		]);

		const connectionReport = await validateConnection(http, "test");

		expect(connectionReport.ok).toBe(true);
		expect(connectionReport.findings[0]?.code).toBe("STORE_NOT_FOUND");
		expect(connectionReport.findings[0]?.severity).toBe("warning");
	});

	test("reports AUTH_FAILED when the key is rejected with a 401", async () => {
		const http = makeHttp([route("/v1/users/me", UNAUTHORIZED_ERROR, 401)]);

		const connectionReport = await validateConnection(http, "test");

		expect(connectionReport.ok).toBe(false);
		expect(connectionReport.findings[0]?.code).toBe("AUTH_FAILED");
	});

	test("flags MODE_MISMATCH when the declared mode differs from meta.test_mode", async () => {
		const http = makeHttp(LIVE_ROUTES);

		const connectionReport = await validateConnection(http, "test");

		const mismatch = connectionReport.findings.find(
			(finding) => finding.code === "MODE_MISMATCH",
		);
		expect(connectionReport.ok).toBe(false);
		expect(connectionReport.resource?.actualMode).toBe("live");
		expect(connectionReport.resource?.declaredMode).toBe("test");
		expect(mismatch?.severity).toBe("error");
		expect(mismatch?.message).toContain("live-mode key");
		expect(mismatch?.suggestedFix).toContain("--mode live");
		expect(mismatch?.context).toEqual({ declared: "test", actual: "live" });
	});

	test("passes when the declared mode matches meta.test_mode", async () => {
		const http = makeHttp(LIVE_ROUTES);

		const connectionReport = await validateConnection(http, "live");

		expect(connectionReport.ok).toBe(true);
		expect(connectionReport.resource?.actualMode).toBe("live");
		expect(connectionReport.findings).toEqual([]);
	});

	test("skips the mode check when meta.test_mode is absent", async () => {
		const userDocumentWithoutMeta = { data: USER_DOCUMENT.data };
		const http = makeHttp([
			route("/v1/users/me", userDocumentWithoutMeta),
			...STORES_ROUTE_ONLY,
		]);

		const connectionReport = await validateConnection(http, "live");

		const modeFinding = connectionReport.findings.find(
			(finding) => finding.code === "MODE_MISMATCH",
		);
		expect(connectionReport.ok).toBe(true);
		expect(connectionReport.resource?.actualMode).toBeUndefined();
		expect(modeFinding).toBeUndefined();
	});

	test("skips the mode check when meta.test_mode is not a boolean", async () => {
		const userDocumentWithNullMode = {
			...USER_DOCUMENT,
			meta: { test_mode: null },
		};
		const http = makeHttp([
			route("/v1/users/me", userDocumentWithNullMode),
			...STORES_ROUTE_ONLY,
		]);

		const connectionReport = await validateConnection(http, "live");

		expect(connectionReport.ok).toBe(true);
		expect(connectionReport.resource?.actualMode).toBeUndefined();
	});
});
