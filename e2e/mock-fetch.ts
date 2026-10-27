import { STORES_COLLECTION, USER_DOC } from "@e2e/sandbox-store.js";

import { readConfig } from "@/client/config.js";
import { createHttp } from "@/client/http.js";

export interface MockRoute {
	match: (request: { method: string; url: string }) => boolean;
	status: number;
	replyDocument: unknown;
}

export interface MockFetchKit {
	fetch: typeof fetch;
	calls: Array<{ method: string; url: string; requestText?: string }>;
}

const API_CONTENT_TYPE = { "content-type": "application/vnd.api+json" };

const readUrlOfRequest = (requestUrl: Parameters<typeof fetch>[0]): string => {
	const isRequestUrlAString = typeof requestUrl === "string";
	if (isRequestUrlAString) return requestUrl;
	const isRequestUrlAUrl = requestUrl instanceof URL;
	if (isRequestUrlAUrl) return requestUrl.toString();
	return requestUrl.url;
};

export const createMockFetch = (routes: MockRoute[]): MockFetchKit => {
	const calls: MockFetchKit["calls"] = [];

	const mock: typeof fetch = async (requestUrl, init) => {
		const url = readUrlOfRequest(requestUrl);
		const method = (init?.method ?? "GET").toUpperCase();
		const isBodyAString = typeof init?.body === "string";
		const requestText = isBodyAString ? (init?.body as string) : undefined;
		calls.push({ method, url, requestText });

		const route = routes.find((mockRoute) => mockRoute.match({ method, url }));
		const isRouteMissing = !route;
		if (isRouteMissing) {
			const noRouteReply = JSON.stringify({
				errors: [
					{
						status: "404",
						code: "no_route",
						title: "No mock route",
						detail: url,
					},
				],
			});
			return new Response(noRouteReply, {
				status: 404,
				headers: API_CONTENT_TYPE,
			});
		}

		const routeReply = JSON.stringify(route.replyDocument);
		return new Response(routeReply, {
			status: route.status,
			headers: API_CONTENT_TYPE,
		});
	};

	return { fetch: mock, calls };
};

export const pathIs = (
	expected: string,
	method = "GET",
): MockRoute["match"] => {
	return ({ method: requestMethod, url }) => {
		const isMethodMatching = requestMethod === method;
		const { pathname } = new URL(url);
		return isMethodMatching && pathname === expected;
	};
};

export const pathIsWithQuery = (
	expected: string,
	query: Record<string, string>,
	method = "GET",
): MockRoute["match"] => {
	return ({ method: requestMethod, url }) => {
		const isMethodDifferent = requestMethod !== method;
		if (isMethodDifferent) return false;
		const parsed = new URL(url);
		const isPathDifferent = parsed.pathname !== expected;
		if (isPathDifferent) return false;
		const queryEntries = Object.entries(query);
		return queryEntries.every(
			([key, expectedValue]) => parsed.searchParams.get(key) === expectedValue,
		);
	};
};

export const SIGNED_IN_ROUTES: MockRoute[] = [
	{ match: pathIs("/v1/users/me"), status: 200, replyDocument: USER_DOC },
	{
		match: pathIs("/v1/stores"),
		status: 200,
		replyDocument: STORES_COLLECTION,
	},
];

export const makeHttp = (routes: MockRoute[]) => {
	const { fetch } = createMockFetch(routes);
	const config = readConfig({ apiKey: "k", fetch });
	return createHttp(config);
};

export const route = (
	path: string,
	replyDocument: unknown,
	status = 200,
): MockRoute => ({
	match: pathIs(path),
	status,
	replyDocument,
});

const okRoute = (
	match: MockRoute["match"],
	replyDocument: unknown,
): MockRoute => ({
	match,
	status: 200,
	replyDocument,
});

export const storeListRoute = (
	collection: string,
	replyDocument: unknown,
): MockRoute => {
	const match = pathIsWithQuery(`/v1/${collection}`, {
		"filter[store_id]": "42",
	});
	return okRoute(match, replyDocument);
};

export const variantListRoute = (
	productId: string,
	replyDocument: unknown,
): MockRoute => {
	const match = pathIsWithQuery("/v1/variants", {
		"filter[product_id]": productId,
	});
	return okRoute(match, replyDocument);
};
