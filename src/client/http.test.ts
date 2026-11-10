import { describe, expect, test } from "vitest";
import { readClientSettings } from "@/client/environment.js";
import {
	STORE_DOCUMENT,
	UNAUTHORIZED_ERROR,
} from "@/lemon-squeezy-fixtures.js";
import {
	createTestHttp,
	readLastRequest,
	readRecordedRequests,
	replyAtPath,
	replyToEveryRequest,
	replyToPages,
	replyWithPlainMessage,
} from "@/mock-lemon-squeezy-api.js";
import { createHttp } from "./http.js";

const API_KEY = "k_test_abc";

const PAGE_COUNT = 3;

const createHttpWithFetch = (fetchRequest: typeof fetch) => {
	const settings = readClientSettings({ apiKey: API_KEY, fetch: fetchRequest });
	return createHttp(settings);
};

describe("createHttp", () => {
	test("getResource reads the resource at the path", async () => {
		const http = createTestHttp([replyAtPath("/v1/stores/42", STORE_DOCUMENT)]);

		const resource = await http.getResource("/v1/stores/42");

		const recordedRequests = await readRecordedRequests();
		expect(resource.id).toBe("42");
		expect(recordedRequests).toHaveLength(1);
		expect(recordedRequests[0]?.url.pathname).toBe("/v1/stores/42");
		expect(recordedRequests[0]?.method).toBe("GET");
	});

	test("request sends the API key as a bearer header", async () => {
		const http = createTestHttp([replyToEveryRequest({})], API_KEY);

		await http.request({ path: "/v1/users/me" });

		const { headers } = await readLastRequest();
		expect(headers.get("Authorization")).toBe(`Bearer ${API_KEY}`);
		expect(headers.get("Accept")).toBe("application/vnd.api+json");
		expect(headers.has("Content-Type")).toBe(false);
	});

	test("request sends a POST document as JSON and returns the parsed reply", async () => {
		const createdDocument = {
			data: {
				type: "customers",
				id: "9",
				attributes: { name: "Ada", email: "ada@example.com" },
			},
		};
		const http = createTestHttp([replyToEveryRequest(createdDocument, 201)]);

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

		const { method, requestDocument } = await readLastRequest();
		expect(createdCustomer.data.id).toBe("9");
		expect(method).toBe("POST");
		expect(requestDocument).toMatchObject({
			data: { attributes: { email: "ada@example.com" } },
		});
	});

	test("request sets the JSON:API content type when it sends a document", async () => {
		const http = createTestHttp([replyToEveryRequest({})]);

		await http.request({ method: "POST", path: "/v1/x", document: {} });

		const { headers } = await readLastRequest();
		expect(headers.get("Content-Type")).toBe("application/vnd.api+json");
	});

	test("request accepts an empty success reply", async () => {
		const http = createTestHttp([replyToEveryRequest(undefined, 204)]);

		const reply = await http.request({
			method: "DELETE",
			path: "/v1/webhooks/7",
		});

		const { method, url } = await readLastRequest();
		expect(reply).toBeUndefined();
		expect(method).toBe("DELETE");
		expect(url.pathname).toBe("/v1/webhooks/7");
	});

	test("request throws UNAUTHORIZED on 401", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/users/me", UNAUTHORIZED_ERROR, 401),
		]);

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
		const http = createTestHttp([
			replyAtPath("/v1/stores/9999", notFoundDocument, 404),
		]);

		await expect(http.getResource("/v1/stores/9999")).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
			message: "Store gone",
			detail: notFoundDocument,
		});
	});

	test("request throws RATE_LIMITED on 429 and uses the error title", async () => {
		const http = createTestHttp([
			replyAtPath(
				"/v1/products",
				{ errors: [{ status: "429", title: "Too Many Requests" }] },
				429,
			),
		]);

		await expect(http.request({ path: "/v1/products" })).rejects.toMatchObject({
			code: "RATE_LIMITED",
			status: 429,
			message: "Too Many Requests",
		});
	});

	test("request uses the JSON:API error code for any other status", async () => {
		const http = createTestHttp([
			replyAtPath(
				"/v1/boom",
				{ errors: [{ code: "invalid_attribute", detail: "Bad name" }] },
				422,
			),
		]);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "invalid_attribute",
			status: 422,
			message: "Bad name",
		});
	});

	test("request falls back to HTTP_status when the error list is empty", async () => {
		const http = createTestHttp([replyAtPath("/v1/boom", { errors: [] }, 500)]);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "HTTP_500",
			status: 500,
			message: "Lemon Squeezy request failed with status 500",
		});
	});

	test("request falls back to HTTP_status when errors is not a list", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/boom", { errors: "broken" }, 502),
		]);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "HTTP_502",
			status: 502,
		});
	});

	test("request skips error entries that are not objects", async () => {
		const http = createTestHttp([
			replyAtPath(
				"/v1/boom",
				{ errors: ["oops", { code: "teapot", title: "Teapot" }] },
				418,
			),
		]);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "teapot",
			message: "Teapot",
		});
	});

	test("request keeps a reply that is not JSON as detail", async () => {
		const http = createTestHttp([
			replyWithPlainMessage("/v1/boom", "Bad gateway", 502),
		]);

		await expect(http.request({ path: "/v1/boom" })).rejects.toMatchObject({
			code: "HTTP_502",
			detail: "Bad gateway",
		});
	});

	test("request fails with HTTP_status when a failed reply has no body", async () => {
		const http = createTestHttp([replyWithPlainMessage("/v1/boom", "", 503)]);

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

		await expect(http.request({ path: "/v1/users/me" })).rejects.toMatchObject({
			name: "FreshSqueezyError",
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
		const http = createTestHttp([replyAtPath("/v1/products", { data: [] })]);

		await http.request({
			path: "/v1/products",
			query: { "filter[store_id]": "1", "filter[status]": undefined },
		});

		const { url } = await readLastRequest();
		expect(url.href).toContain("filter%5Bstore_id%5D=1");
		expect(url.searchParams.get("filter[store_id]")).toBe("1");
		expect(url.searchParams.has("filter[status]")).toBe(false);
	});

	test("getAll walks every page until the last page and joins them", async () => {
		const http = createTestHttp([
			replyToPages("/v1/products", PAGE_COUNT, (page) => [
				`${page}a`,
				`${page}b`,
			]),
		]);

		const resources = await http.getAll("/v1/products");

		const resourceIds = resources.map((resource) => resource.id);
		expect(resourceIds).toEqual(["1a", "1b", "2a", "2b", "3a", "3b"]);
	});

	test("getAll returns after one request when the reply has no page meta", async () => {
		const http = createTestHttp([
			replyAtPath("/v1/stores", {
				data: [
					{ type: "stores", id: "1", attributes: { name: "x", slug: "x" } },
				],
			}),
		]);

		const resources = await http.getAll("/v1/stores");

		const recordedRequests = await readRecordedRequests();
		expect(resources).toHaveLength(1);
		expect(recordedRequests).toHaveLength(1);
	});

	test("getAll starts at the page the caller asks for", async () => {
		const http = createTestHttp([
			replyToPages("/v1/products", PAGE_COUNT, (page) => [`${page}`]),
		]);

		const resources = await http.getAll("/v1/products", { "page[number]": 2 });

		const resourceIds = resources.map((resource) => resource.id);
		expect(resourceIds).toEqual(["2", "3"]);
	});

	test("getAll asks for 100 resources per page", async () => {
		const http = createTestHttp([replyAtPath("/v1/stores", { data: [] })]);

		await http.getAll("/v1/stores");

		const { url } = await readLastRequest();
		expect(url.searchParams.get("page[size]")).toBe("100");
		expect(url.searchParams.get("page[number]")).toBe("1");
	});
});
