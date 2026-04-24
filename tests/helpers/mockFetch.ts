/**
 * Minimal fetch mock used across unit tests. A route map maps a matcher over
 * (method, path) to a response body + status. Tests can assert which paths
 * were hit via the returned `calls` array.
 */

export interface MockRoute {
  match: (req: { method: string; url: string }) => boolean;
  status: number;
  body: unknown;
}

export interface MockFetchResult {
  fetch: typeof fetch;
  calls: Array<{ method: string; url: string; body?: string }>;
}

export function createMockFetch(routes: MockRoute[]): MockFetchResult {
  const calls: MockFetchResult["calls"] = [];

  const mock: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ method, url, body });

    const route = routes.find((entry) => entry.match({ method, url }));
    if (!route) {
      return new Response(JSON.stringify({ errors: [{ status: "404", code: "no_route", title: "No mock route", detail: url }] }), {
        status: 404,
        headers: { "content-type": "application/vnd.api+json" },
      });
    }

    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { "content-type": "application/vnd.api+json" },
    });
  };

  return { fetch: mock, calls };
}

export function pathIs(expected: string, method = "GET"): MockRoute["match"] {
  return ({ method: m, url }) => m === method && new URL(url).pathname === expected;
}

export function pathIsWithQuery(expected: string, query: Record<string, string>, method = "GET"): MockRoute["match"] {
  return ({ method: m, url }) => {
    if (m !== method) return false;
    const parsed = new URL(url);
    if (parsed.pathname !== expected) return false;
    return Object.entries(query).every(([key, value]) => parsed.searchParams.get(key) === value);
  };
}
