import { createMockFetch, pathIs } from "@e2e/mock-fetch.js";
import { STORE_DOC, UNAUTHORIZED_ERROR } from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { readClientSettings } from "@/client/environment.js";
import { isFreshSqueezyError } from "@/client/errors.js";
import { createHttp } from "./http.js";

const API_KEY = "k_test_abc";

const PAGE_COUNT = 3;

const readUrlOfRequest = (requestUrl: Parameters<typeof fetch>[0]) => {
	const isRequestUrlAString = typeof requestUrl === "string";
	if (isRequestUrlAString) return requestUrl;
	const isRequestUrlAUrl = requestUrl instanceof URL;
	if (isRequestUrlAUrl) return requestUrl.toString();
	return requestUrl.url;
};

const createHttpWithFetch = (fetchRequest: typeof fetch) => {
	const settings = readClientSettings({ apiKey: API_KEY, fetch: fetchRequest });
	return createHttp(settings);
};

const createReplyFetch = (
	replyString: string,
	status: number,
): typeof fetch => {
	return async () => new Response(replyString, { status });
};

const createPagedFetch = (
	listIdsOfPage: (page: number) => string[],
): typeof fetch => {
	return async (requestUrl) => {
		const url = readUrlOfRequest(requestUrl);
		const page = Number(new URL(url).searchParams.get("page[number]") ?? 1);
		const resources = listIdsOfPage(page).map((id) => ({
			type: "products",
			id,
			attributes: {},
		}));
		const pageDocument = {
			data: resources,
			meta: { page: { currentPage: page, lastPage: PAGE_COUNT, total: 6 } },
		};
		return new Response(JSON.stringify(pageDocument), { status: 200 });
	};
};

describe("createHttp", () => {
	test("getResource sends bearer auth and returns the resource", async () => {
		const { fetch, calls } = createMockFetch([
			{
				accepts: pathIs("/v1/stores/42"),
				status: 200,
				replyDocument: STORE_DOC,
			},
		]);
		const http = createHttpWithFetch(fetch);

		const resource = await http.getResource("/v1/stores/42");

		expect(resource.id).toBe("42");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toContain("/v1/stores/42");
		expect(calls[0]?.method).toBe("GET");
	});

	test("request sends the API key as a bearer header", async () => {
		const sentHeaders: Headers[] = [];
		const fetchRequest: typeof fetch = async (_requestUrl, requestInit) => {
			sentHeaders.push(new Headers(requestInit?.headers));
			return new Response("{}", { status: 200 });
		};
		const http = createHttpWithFetch(fetchRequest);

		await http.request({ path: "/v1/users/me" });

		expect(sentHeaders[0]?.get("Authorization")).toBe(`Bearer ${API_KEY}`);
		expect(sentHeaders[0]?.get("Accept")).toBe("application/vnd.api+json");
		expect(sentHeaders[0]?.has("Content-Type")).toBe(false);
	});

	test("request sends a POST document as JSON and returns the parsed reply", async () => {
		const createdDocument = {
			data: {
				type: "customers",
				id: "9",
				attributes: { name: "Ada", email: "ada@example.com" },
			},
		};
		const { fetch, calls } = createMockFetch([
			{
				accepts: pathIs("/v1/customers", "POST"),
				status: 201,
				replyDocument: createdDocument,
			},
		]);
		const http = createHttpWithFetch(fetch);

		const createdCustomer = await http.request<typeof createdDocument>({
			method: "POST",
			path: "/v1/customers",
			document: {
				data: {
					type: "customers",
					attributes: { name: "Ada", email: "ada@example.com" },
				},
			},
		});

		expect(createdCustomer.data.id).toBe("9");
		expect(calls[0]?.method).toBe("POST");
		expect(calls[0]?.requestString).toContain("ada@example.com");
	});

	test("request sets the JSON:API content type when it sends a document", async () => {
		const sentHeaders: Headers[] = [];
		const fetchRequest: typeof fetch = async (_requestUrl, requestInit) => {
			sentHeaders.push(new Headers(requestInit?.headers));
			return new Response("{}", { status: 200 });
		};
		const http = createHttpWithFetch(fetchRequest);

		await http.request({ method: "POST", path: "/v1/x", document: {} });

		expect(sentHeaders[0]?.get("Content-Type")).toBe(
			"application/vnd.api+json",
		);
	});

	test("request accepts an empty success reply", async () => {
		const sentRequests: Array<{ pathname: string; method?: string }> = [];
		const fetchRequest: typeof fetch = async (requestUrl, requestInit) => {
			const url = readUrlOfRequest(requestUrl);
			sentRequests.push({
				pathname: new URL(url).pathname,
				method: requestInit?.method,
			});
			// A null body, because undici rejects a body on a 204 reply.
			return new Response(null, { status: 204 });
		};
		const http = createHttpWithFetch(fetchRequest);

		const reply = await http.request({
			method: "DELETE",
			path: "/v1/webhooks/7",
		});

		expect(reply).toBeUndefined();
		expect(sentRequests).toEqual([
			{ pathname: "/v1/webhooks/7", method: "DELETE" },
		]);
	});

	test("request throws UNAUTHORIZED on 401", async () => {
		const { fetch } = createMockFetch([
			{
				accepts: pathIs("/v1/users/me"),
				status: 401,
				replyDocument: UNAUTHORIZED_ERROR,
			},
		]);
		const http = createHttpWithFetch(fetch);

		await expect(http.request({ path: "/v1/users/me" })).rejects.toMatchObject({
			name: "FreshSqueezyError",
			code: "UNAUTHORIZED",
			status: 401,
			message: "Invalid API key",
		});
	});

	test("request throws NOT_FOUND on 404 and keeps the reply as detail", async () => {
		const notFoundDocument = {
			errors: [{ status: "404", code: "not_found", detail: "Store gone" }],
		};
		const { fetch } = createMockFetch([
			{
				accepts: pathIs("/v1/stores/9999"),
				status: 404,
				replyDocument: notFoundDocument,
			},
		]);
		const http = createHttpWithFetch(fetch);

		await expect(http.getResource("/v1/stores/9999")).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
			message: "Store gone",
			detail: notFoundDocument,
		});
	});

	test("request throws RATE_LIMITED on 429 and uses the error title", async () => {
		const { fetch } = createMockFetch([
			{
				accepts: pathIs("/v1/products"),
				status: 429,
				replyDocument: {
					errors: [{ status: "429", title: "Too Many Requests" }],
				},
			},
		]);
		const http = createHttpWithFetch(fetch);

		await expect(http.request({ path: "/v1/products" })).rejects.toMatchObject({
			code: "RATE_LIMITED",
			status: 429,
			message: "Too Many Requests",
		});
	});

	test("request uses the JSON:API error code for any other status", async () => {
		const { fetch } = createMockFetch([
			{
				accepts: pathIs("/v1/boom"),
				status: 422,
				replyDocument: {
					errors: [{ code: "invalid_attribute", detail: "Bad name" }],
				},
			},
		]);
		const http = createHttpWithFetch(fetch);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "invalid_attribute",
			status: 422,
			message: "Bad name",
		});
	});

	test("request falls back to HTTP_status when the error list is empty", async () => {
		const { fetch } = createMockFetch([
			{
				accepts: pathIs("/v1/boom"),
				status: 500,
				replyDocument: { errors: [] },
			},
		]);
		const http = createHttpWithFetch(fetch);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "HTTP_500",
			status: 500,
			message: "Lemon Squeezy request failed with status 500",
		});
	});

	test("request falls back to HTTP_status when errors is not a list", async () => {
		const fetchRequest = createReplyFetch(
			JSON.stringify({ errors: "broken" }),
			502,
		);
		const http = createHttpWithFetch(fetchRequest);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "HTTP_502",
			status: 502,
		});
	});

	test("request skips error entries that are not objects", async () => {
		const fetchRequest = createReplyFetch(
			JSON.stringify({ errors: ["oops", { code: "teapot", title: "Teapot" }] }),
			418,
		);
		const http = createHttpWithFetch(fetchRequest);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "teapot",
			message: "Teapot",
		});
	});

	test("request keeps a reply that is not JSON as detail", async () => {
		const fetchRequest = createReplyFetch("Bad gateway", 502);
		const http = createHttpWithFetch(fetchRequest);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "HTTP_502",
			detail: "Bad gateway",
		});
	});

	test("request fails with HTTP_status when a failed reply has no body", async () => {
		const fetchRequest = createReplyFetch("", 503);
		const http = createHttpWithFetch(fetchRequest);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "HTTP_503",
			status: 503,
		});
	});

	test("request throws NETWORK_ERROR with the cause message when fetch fails", async () => {
		const fetchRequest: typeof fetch = async () => {
			throw new Error("ECONNRESET");
		};
		const http = createHttpWithFetch(fetchRequest);

		let thrownError: unknown = null;
		try {
			await http.request({ path: "/v1/users/me" });
		} catch (caughtError) {
			thrownError = caughtError;
		}

		expect(isFreshSqueezyError(thrownError)).toBe(true);
		expect(thrownError).toMatchObject({
			code: "NETWORK_ERROR",
			message: "ECONNRESET",
		});
	});

	test("request throws NETWORK_ERROR with a default message when fetch throws a non-error", async () => {
		const fetchRequest: typeof fetch = async () => {
			throw "offline";
		};
		const http = createHttpWithFetch(fetchRequest);

		await expect(http.request({ path: "/v1/users/me" })).rejects.toMatchObject({
			code: "NETWORK_ERROR",
			message: "Network request failed",
			detail: "offline",
		});
	});

	test("request sends bracket query names and skips undefined query fields", async () => {
		const { fetch, calls } = createMockFetch([
			{
				accepts: pathIs("/v1/products"),
				status: 200,
				replyDocument: { data: [] },
			},
		]);
		const http = createHttpWithFetch(fetch);

		await http.request({
			path: "/v1/products",
			query: { "filter[store_id]": "1", "filter[status]": undefined },
		});

		const url = new URL(calls[0]?.url ?? "");
		expect(calls[0]?.url).toContain("filter%5Bstore_id%5D=1");
		expect(url.searchParams.get("filter[store_id]")).toBe("1");
		expect(url.searchParams.has("filter[status]")).toBe(false);
	});

	test("getAll walks every page until the last page and joins them", async () => {
		const fetchRequest = createPagedFetch((page) => [`${page}a`, `${page}b`]);
		const http = createHttpWithFetch(fetchRequest);

		const resources = await http.getAll("/v1/products");

		const resourceIds = resources.map((resource) => resource.id);
		expect(resourceIds).toEqual(["1a", "1b", "2a", "2b", "3a", "3b"]);
	});

	test("getAll returns after one request when the reply has no page meta", async () => {
		const { fetch, calls } = createMockFetch([
			{
				accepts: pathIs("/v1/stores"),
				status: 200,
				replyDocument: {
					data: [
						{ type: "stores", id: "1", attributes: { name: "x", slug: "x" } },
					],
				},
			},
		]);
		const http = createHttpWithFetch(fetch);

		const resources = await http.getAll("/v1/stores");

		expect(resources).toHaveLength(1);
		expect(calls).toHaveLength(1);
	});

	test("getAll starts at the page the caller asks for", async () => {
		const fetchRequest = createPagedFetch((page) => [`${page}`]);
		const http = createHttpWithFetch(fetchRequest);

		const resources = await http.getAll("/v1/products", { "page[number]": 2 });

		const resourceIds = resources.map((resource) => resource.id);
		expect(resourceIds).toEqual(["2", "3"]);
	});

	test("getAll asks for 100 resources per page", async () => {
		const { fetch, calls } = createMockFetch([
			{
				accepts: pathIs("/v1/stores"),
				status: 200,
				replyDocument: { data: [] },
			},
		]);
		const http = createHttpWithFetch(fetch);

		await http.getAll("/v1/stores");

		const url = new URL(calls[0]?.url ?? "");
		expect(url.searchParams.get("page[size]")).toBe("100");
		expect(url.searchParams.get("page[number]")).toBe("1");
	});
});
