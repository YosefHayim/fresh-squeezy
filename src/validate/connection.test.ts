import {
	liveUserDoc,
	storesCollection,
	unauthorizedError,
	userDoc,
} from "@e2e/fixtures/sandbox/data.js";
import { createMockFetch, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { HttpClient } from "@/http/http.js";
import { resolveConfig } from "@/shared/config.js";
import {
	fetchActualMode,
	resolveActualMode,
	validateConnection,
} from "./connection.js";

const makeClient = (routes: Parameters<typeof createMockFetch>[0]) => {
	const { fetch } = createMockFetch(routes);
	return new HttpClient(resolveConfig({ apiKey: "k", fetch, mode: "test" }));
};

test("validateConnection returns ok when key auths and stores are reachable", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
	]);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.mode).toBe("test");
	expect(connectionValidation.resource?.storeCount).toBe(1);
	expect(connectionValidation.resource?.storeIds).toEqual(["42"]);
});

test("validateConnection warns when no stores reachable", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: { data: [] } },
	]);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.issues[0]?.code).toBe("STORE_NOT_FOUND");
	expect(connectionValidation.issues[0]?.severity).toBe("warning");
});

test("validateConnection surfaces AUTH_FAILED on 401", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 401, body: unauthorizedError },
	]);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(false);
	expect(connectionValidation.issues[0]?.code).toBe("AUTH_FAILED");
});

test("validateConnection flags MODE_MISMATCH when declared mode differs from meta.test_mode", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: liveUserDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
	]);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(false);
	expect(connectionValidation.resource?.actualMode).toBe("live");
	expect(connectionValidation.resource?.declaredMode).toBe("test");
	const mismatch = connectionValidation.issues.find(
		(entry) => entry.code === "MODE_MISMATCH",
	);
	expect(mismatch?.severity).toBe("error");
	expect(mismatch?.context).toMatchObject({ declared: "test", actual: "live" });
});

test("validateConnection passes when declared mode matches meta.test_mode", async () => {
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: liveUserDoc },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
	]);

	const connectionValidation = await validateConnection(http, "live");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.resource?.actualMode).toBe("live");
});

test("validateConnection skips mode check when meta.test_mode is absent", async () => {
	const docWithoutMeta = { data: userDoc.data };
	const http = makeClient([
		{ match: pathIs("/v1/users/me"), status: 200, body: docWithoutMeta },
		{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
	]);

	const connectionValidation = await validateConnection(http, "live");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.resource?.actualMode).toBeUndefined();
	expect(
		connectionValidation.issues.find((entry) => entry.code === "MODE_MISMATCH"),
	).toBeUndefined();
});

test("fetchActualMode derives mode from /v1/users/me meta", async () => {
	const { fetch } = createMockFetch([
		{
			match: pathIs("/v1/users/me"),
			status: 200,
			body: {
				data: {
					type: "users",
					id: "1",
					attributes: { name: "x", email: "x@x" },
				},
				meta: { test_mode: true },
			},
		},
	]);
	const http = new HttpClient({
		apiKey: "k",
		mode: "test",
		baseUrl: "https://api.lemonsqueezy.com",
		fetch,
	});

	expect(await fetchActualMode(http)).toBe("test");
});

test("fetchActualMode returns undefined when the API does not surface meta.test_mode", async () => {
	const { fetch } = createMockFetch([
		{
			match: pathIs("/v1/users/me"),
			status: 200,
			body: {
				data: {
					type: "users",
					id: "1",
					attributes: { name: "x", email: "x@x" },
				},
			},
		},
	]);
	const http = new HttpClient({
		apiKey: "k",
		mode: "live",
		baseUrl: "https://api.lemonsqueezy.com",
		fetch,
	});

	expect(await fetchActualMode(http)).toBeUndefined();
});

test("resolveActualMode returns 'test' when test_mode is true", () => {
	expect(resolveActualMode(true)).toBe("test");
});

test("resolveActualMode returns 'live' when test_mode is false", () => {
	expect(resolveActualMode(false)).toBe("live");
});

test("resolveActualMode returns undefined when test_mode is missing", () => {
	expect(resolveActualMode(undefined)).toBeUndefined();
});
