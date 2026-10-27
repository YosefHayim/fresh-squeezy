import { STORES_COLLECTION, USER_DOC } from "@e2e/sandbox-store.js";

import { readClientSettings } from "@/client/environment.js";
import { createHttp } from "@/client/http.js";

export interface MockRoute {
	accepts: (request: { method: string; url: string }) => boolean;
	status: number;
	replyDocument: unknown;
}

export interface MockFetchKit {
	fetch: typeof fetch;
	calls: Array<{ method: string; url: string; requestString?: string }>;
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
		const isRequestDocumentString = typeof init?.body === "string";
		const requestString = isRequestDocumentString
			? (init?.body as string)
			: undefined;
		calls.push({ method, url, requestString });

		const route = routes.find((mockRoute) =>
			mockRoute.accepts({ method, url }),
		);
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
): MockRoute["accepts"] => {
	return ({ method: requestMethod, url }) => {
		const isMethodSame = requestMethod === method;
		const { pathname } = new URL(url);
		return isMethodSame && pathname === expected;
	};
};

export const pathIsWithQuery = (
	expected: string,
	query: Record<string, string>,
	method = "GET",
): MockRoute["accepts"] => {
	return ({ method: requestMethod, url }) => {
		const isMethodDifferent = requestMethod !== method;
		if (isMethodDifferent) return false;
		const requestedUrl = new URL(url);
		const isPathDifferent = requestedUrl.pathname !== expected;
		if (isPathDifferent) return false;
		const queryPairs = Object.entries(query);
		return queryPairs.every(
			([name, expectedTerm]) =>
				requestedUrl.searchParams.get(name) === expectedTerm,
		);
	};
};

export const SIGNED_IN_ROUTES: MockRoute[] = [
	{ accepts: pathIs("/v1/users/me"), status: 200, replyDocument: USER_DOC },
	{
		accepts: pathIs("/v1/stores"),
		status: 200,
		replyDocument: STORES_COLLECTION,
	},
];

export const makeHttp = (routes: MockRoute[]) => {
	const { fetch } = createMockFetch(routes);
	const settings = readClientSettings({ apiKey: "k", fetch });
	return createHttp(settings);
};

export const route = (
	path: string,
	replyDocument: unknown,
	status = 200,
): MockRoute => ({
	accepts: pathIs(path),
	status,
	replyDocument,
});

const okRoute = (
	accepts: MockRoute["accepts"],
	replyDocument: unknown,
): MockRoute => ({
	accepts,
	status: 200,
	replyDocument,
});

export const storeListRoute = (
	collection: string,
	replyDocument: unknown,
): MockRoute => {
	const accepts = pathIsWithQuery(`/v1/${collection}`, {
		"filter[store_id]": "42",
	});
	return okRoute(accepts, replyDocument);
};

export const variantListRoute = (
	productId: string,
	replyDocument: unknown,
): MockRoute => {
	const accepts = pathIsWithQuery("/v1/variants", {
		"filter[product_id]": productId,
	});
	return okRoute(accepts, replyDocument);
};
