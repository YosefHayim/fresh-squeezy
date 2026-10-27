import { storesCollection, userDoc } from "@e2e/fixtures/sandbox/data.js";
import { vi } from "vitest";

import { resolveConfig } from "@/shared/config.js";
import { HttpClient } from "@/shared/http.js";

export interface MockRoute {
	match: (req: { method: string; url: string }) => boolean;
	status: number;
	body: unknown;
}

export interface MockFetchResult {
	fetch: typeof fetch;
	calls: Array<{ method: string; url: string; body?: string }>;
}

const API_CONTENT_TYPE = { "content-type": "application/vnd.api+json" };

const urlOfInput = (input: Parameters<typeof fetch>[0]): string => {
	const isInputAString = typeof input === "string";
	if (isInputAString) return input;
	const isInputAUrl = input instanceof URL;
	if (isInputAUrl) return input.toString();
	return input.url;
};

export const createMockFetch = (routes: MockRoute[]): MockFetchResult => {
	const calls: MockFetchResult["calls"] = [];

	const mock: typeof fetch = async (input, init) => {
		const url = urlOfInput(input);
		const method = (init?.method ?? "GET").toUpperCase();
		const isBodyAString = typeof init?.body === "string";
		const body = isBodyAString ? (init?.body as string) : undefined;
		calls.push({ method, url, body });

		const route = routes.find((entry) => entry.match({ method, url }));
		const isRouteMissing = !route;
		if (isRouteMissing) {
			const noRouteBody = JSON.stringify({
				errors: [
					{
						status: "404",
						code: "no_route",
						title: "No mock route",
						detail: url,
					},
				],
			});
			return new Response(noRouteBody, {
				status: 404,
				headers: API_CONTENT_TYPE,
			});
		}

		const routeBody = JSON.stringify(route.body);
		return new Response(routeBody, {
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
	return ({ method: m, url }) => {
		const isMethodMatching = m === method;
		const { pathname } = new URL(url);
		return isMethodMatching && pathname === expected;
	};
};

export const pathIsWithQuery = (
	expected: string,
	query: Record<string, string>,
	method = "GET",
): MockRoute["match"] => {
	return ({ method: m, url }) => {
		const isMethodDifferent = m !== method;
		if (isMethodDifferent) return false;
		const parsed = new URL(url);
		const isPathDifferent = parsed.pathname !== expected;
		if (isPathDifferent) return false;
		const queryEntries = Object.entries(query);
		return queryEntries.every(
			([key, value]) => parsed.searchParams.get(key) === value,
		);
	};
};

export const SIGNED_IN_ROUTES: MockRoute[] = [
	{ match: pathIs("/v1/users/me"), status: 200, body: userDoc },
	{ match: pathIs("/v1/stores"), status: 200, body: storesCollection },
];

export const stubFetch = (routes: MockRoute[]): MockFetchResult => {
	const mock = createMockFetch(routes);
	vi.stubGlobal("fetch", mock.fetch);
	return mock;
};

export const silenceStdout = () =>
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);

export const makeClient = (routes: MockRoute[]): HttpClient => {
	const { fetch } = createMockFetch(routes);
	const config = resolveConfig({ apiKey: "k", fetch });
	return new HttpClient(config);
};
