import { STORE_DOC, UNAUTHORIZED_ERROR } from "@e2e/fixtures/sandbox/data.js";
import { createMockFetch, pathIs } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { readConfig } from "@/shared/config.js";
import { isFreshSqueezyError } from "@/shared/errors.js";
import { createHttp } from "./http.js";

test("http sends bearer auth and returns parsed JSON", async () => {
	const { fetch, calls } = createMockFetch([
		{ match: pathIs("/v1/stores/42"), status: 200, body: STORE_DOC },
	]);
	const http = createHttp(readConfig({ apiKey: "k_test_abc", fetch }));

	const resource = await http.getResource("/v1/stores/42");

	expect(resource.id).toBe("42");
	expect(calls).toHaveLength(1);
	expect(calls[0]?.url).toContain("/v1/stores/42");
	expect(calls[0]?.method).toBe("GET");
});

test("http throws FreshSqueezyError with UNAUTHORIZED on 401", async () => {
	const { fetch } = createMockFetch([
		{ match: pathIs("/v1/users/me"), status: 401, body: UNAUTHORIZED_ERROR },
	]);
	const http = createHttp(readConfig({ apiKey: "bad", fetch }));

	await expect(http.request({ path: "/v1/users/me" })).rejects.toMatchObject({
		name: "FreshSqueezyError",
		code: "UNAUTHORIZED",
		status: 401,
	});
});

test("http throws NOT_FOUND on 404 and preserves JSON:API detail", async () => {
	const { fetch } = createMockFetch([
		{
			match: pathIs("/v1/stores/9999"),
			status: 404,
			body: {
				errors: [{ status: "404", code: "not_found", detail: "Store gone" }],
			},
		},
	]);
	const http = createHttp(readConfig({ apiKey: "k", fetch }));

	await expect(http.getResource("/v1/stores/9999")).rejects.toMatchObject({
		code: "NOT_FOUND",
		status: 404,
		message: "Store gone",
	});
});

test("http throws RATE_LIMITED on 429", async () => {
	const { fetch } = createMockFetch([
		{
			match: pathIs("/v1/products"),
			status: 429,
			body: { errors: [{ status: "429", title: "Too Many Requests" }] },
		},
	]);
	const http = createHttp(readConfig({ apiKey: "k", fetch }));

	await expect(http.request({ path: "/v1/products" })).rejects.toMatchObject({
		code: "RATE_LIMITED",
		status: 429,
		message: "Too Many Requests",
	});
});

test("http falls back to HTTP_<status> when no JSON:API code is present", async () => {
	const { fetch } = createMockFetch([
		{ match: pathIs("/v1/boom"), status: 500, body: { errors: [] } },
	]);
	const http = createHttp(readConfig({ apiKey: "k", fetch }));

	await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
		code: "HTTP_500",
		status: 500,
	});
});

test("http maps network failures to NETWORK_ERROR", async () => {
	const fetchImpl: typeof fetch = async () => {
		throw new Error("ECONNRESET");
	};
	const http = createHttp(readConfig({ apiKey: "k", fetch: fetchImpl }));

	const thrown = await http
		.request({ path: "/v1/users/me" })
		.catch((caught) => caught);
	expect(isFreshSqueezyError(thrown)).toBe(true);
	expect((thrown as { code: string }).code).toBe("NETWORK_ERROR");
});

test("http request sends a POST body as JSON and returns the parsed document", async () => {
	const createDoc = {
		data: {
			type: "customers",
			id: "9",
			attributes: { name: "Ada", email: "ada@example.com" },
		},
	};
	const { fetch, calls } = createMockFetch([
		{ match: pathIs("/v1/customers", "POST"), status: 201, body: createDoc },
	]);
	const http = createHttp(readConfig({ apiKey: "k", fetch }));

	const createdCustomer = await http.request<typeof createDoc>({
		method: "POST",
		path: "/v1/customers",
		body: {
			data: {
				type: "customers",
				attributes: { name: "Ada", email: "ada@example.com" },
			},
		},
	});

	expect(createdCustomer.data.id).toBe("9");
	expect(calls[0]?.method).toBe("POST");
	expect(calls[0]?.body).toContain("ada@example.com");
});

const pagedFetch = (
	itemsOfPage: (page: number) => unknown[],
	total: number,
): typeof fetch => {
	return async (input) => {
		const isInputAString = typeof input === "string";
		const url = isInputAString ? input : (input as URL).toString();
		const page = Number(new URL(url).searchParams.get("page[number]") ?? 1);
		const pageBody = {
			data: itemsOfPage(page),
			meta: { page: { currentPage: page, lastPage: 3, total } },
		};
		return new Response(JSON.stringify(pageBody), {
			status: 200,
			headers: { "content-type": "application/vnd.api+json" },
		});
	};
};

test("http request accepts empty success bodies", async () => {
	const fetchImpl: typeof fetch = async (input, init) => {
		const isInputAString = typeof input === "string";
		const url = isInputAString ? input : (input as URL).toString();
		expect(new URL(url).pathname).toBe("/v1/webhooks/7");
		expect((init?.method ?? "GET").toUpperCase()).toBe("DELETE");
		// null body — undici rejects non-null body with 204
		return new Response(null, { status: 204 });
	};
	const http = createHttp(readConfig({ apiKey: "k", fetch: fetchImpl }));

	await expect(
		http.request({ method: "DELETE", path: "/v1/webhooks/7" }),
	).resolves.toBeUndefined();
});

test("http paginate() walks every page until lastPage and concatenates results", async () => {
	const fetchImpl = pagedFetch(
		(page) => [
			{ type: "products", id: `${page}a`, attributes: { name: `p${page}a` } },
			{ type: "products", id: `${page}b`, attributes: { name: `p${page}b` } },
		],
		6,
	);
	const http = createHttp(readConfig({ apiKey: "k", fetch: fetchImpl }));

	const all = await http.getAll("/v1/products");
	expect(all).toHaveLength(6);
	expect(all.map((resource) => resource.id)).toEqual([
		"1a",
		"1b",
		"2a",
		"2b",
		"3a",
		"3b",
	]);
});

test("http paginate() returns immediately when meta.page is absent", async () => {
	const { fetch, calls } = createMockFetch([
		{
			match: pathIs("/v1/stores"),
			status: 200,
			body: {
				data: [
					{ type: "stores", id: "1", attributes: { name: "x", slug: "x" } },
				],
			},
		},
	]);
	const http = createHttp(readConfig({ apiKey: "k", fetch }));

	const all = await http.getAll("/v1/stores");
	expect(all).toHaveLength(1);
	expect(calls).toHaveLength(1);
});

test("http paginate() honors a caller-supplied starting page[number]", async () => {
	const fetchImpl = pagedFetch(
		(page) => [{ type: "x", id: `${page}`, attributes: {} }],
		3,
	);
	const http = createHttp(readConfig({ apiKey: "k", fetch: fetchImpl }));

	const all = await http.getAll("/v1/x", { "page[number]": 2 });
	expect(all.map((resource) => resource.id)).toEqual(["2", "3"]);
});

test("http serializes JSON:API bracket query params via URLSearchParams", async () => {
	const { fetch, calls } = createMockFetch([
		{
			match: ({ method, url }) =>
				method === "GET" &&
				new URL(url).pathname === "/v1/products" &&
				new URL(url).searchParams.get("filter[store_id]") === "42",
			status: 200,
			body: { data: [] },
		},
	]);
	const http = createHttp(readConfig({ apiKey: "k", fetch }));

	await http.request({
		path: "/v1/products",
		query: { "filter[store_id]": "42" },
	});

	// URLSearchParams percent-encodes brackets; searchParams.get still decodes them.
	expect(calls[0]?.url).toContain("filter%5Bstore_id%5D=42");
});

test("http skips undefined query values", async () => {
	const { fetch, calls } = createMockFetch([
		{ match: pathIs("/v1/products"), status: 200, body: { data: [] } },
	]);
	const http = createHttp(readConfig({ apiKey: "k", fetch }));

	await http.request({
		path: "/v1/products",
		query: { "filter[store_id]": "1", "filter[status]": undefined },
	});

	const url = new URL(calls[0]?.url ?? "");
	expect(url.searchParams.get("filter[store_id]")).toBe("1");
	expect(url.searchParams.has("filter[status]")).toBe(false);
});
