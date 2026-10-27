import type { Config } from "./config.js";
import { type FreshSqueezyError, freshSqueezyErrorOf } from "./errors.js";

const PAGE_SIZE = 100;

const LICENSE_API_URL = "https://api.lemonsqueezy.com";

const API_CONTENT_TYPE = "application/vnd.api+json";

const HTTP_STATUS_CODES = {
	401: "UNAUTHORIZED",
	404: "NOT_FOUND",
	429: "RATE_LIMITED",
} as const;

export type HttpQuery = Record<string, string | number | undefined>;

export interface HttpRequest {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	path: string;
	query?: HttpQuery;
	body?: unknown;
	signal?: AbortSignal;
}

export interface JsonApiResource<Attributes> {
	type: string;
	id: string;
	attributes: Attributes;
	relationships?: Record<string, unknown>;
	links?: Record<string, string>;
}

export interface JsonApiDocument<Attributes> {
	data: JsonApiResource<Attributes>;
	links?: Record<string, string>;
	meta?: Record<string, unknown>;
}

export interface JsonApiCollection<Attributes> {
	data: JsonApiResource<Attributes>[];
	links?: Record<string, string>;
	meta?: { page?: { currentPage: number; lastPage: number; total: number } };
}

interface JsonApiError {
	status?: string;
	code?: string;
	title?: string;
	detail?: string;
}

const requestUrlOf = (config: Config, path: string, query?: HttpQuery) => {
	const url = new URL(path, config.baseUrl);
	const queryEntries = Object.entries(query ?? {});
	for (const [key, value] of queryEntries) {
		const isValueMissing = value === undefined;
		if (isValueMissing) continue;
		const valueText = String(value);
		url.searchParams.append(key, valueText);
	}
	return url.toString();
};

const parseJsonBody = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

const jsonApiErrorsOf = (responseBody: unknown): JsonApiError[] => {
	const isBodyNotAnObject = !responseBody || typeof responseBody !== "object";
	if (isBodyNotAnObject) return [];
	const errors = (responseBody as { errors?: unknown }).errors;
	const isErrorsNotAnArray = !Array.isArray(errors);
	if (isErrorsNotAnArray) return [];
	return errors.filter(
		(entry): entry is JsonApiError =>
			typeof entry === "object" && entry !== null,
	);
};

const apiErrorOf = (
	status: number,
	responseBody: unknown,
): FreshSqueezyError => {
	const [firstError] = jsonApiErrorsOf(responseBody);
	const mappedCode =
		HTTP_STATUS_CODES[status as keyof typeof HTTP_STATUS_CODES];
	const code = mappedCode ?? firstError?.code ?? `HTTP_${status}`;
	const message =
		firstError?.detail ??
		firstError?.title ??
		`Lemon Squeezy request failed with status ${status}`;
	return freshSqueezyErrorOf({ code, status, message, detail: responseBody });
};

const networkErrorOf = (cause: unknown) => {
	const isCauseAnError = cause instanceof Error;
	const message = isCauseAnError ? cause.message : "Network request failed";
	return freshSqueezyErrorOf({ code: "NETWORK_ERROR", message, detail: cause });
};

const sendRequest = async <Payload>(
	config: Config,
	{ method = "GET", path, query, body, signal }: HttpRequest,
) => {
	const url = requestUrlOf(config, path, query);
	const headers: Record<string, string> = {
		Authorization: `Bearer ${config.apiKey}`,
		Accept: API_CONTENT_TYPE,
	};
	const hasBody = body !== undefined;
	if (hasBody) headers["Content-Type"] = API_CONTENT_TYPE;

	const bodyText = hasBody ? JSON.stringify(body) : undefined;
	const response = await config
		.fetch(url, { method, headers, body: bodyText, signal })
		.catch((cause: unknown) => {
			throw networkErrorOf(cause);
		});

	const text = await response.text();
	const isBodyPresent = text.length > 0;
	const parsedBody = isBodyPresent ? parseJsonBody(text) : undefined;
	const isResponseFailed = !response.ok;
	if (isResponseFailed) throw apiErrorOf(response.status, parsedBody);
	return parsedBody as Payload;
};

export interface LicenseFormRequest {
	action: "activate" | "validate" | "deactivate";
	fields: Record<string, string | undefined>;
}

// The license API takes no API key and answers 4xx with a JSON body that carries `error`.
export const postLicenseForm = async <Payload>({
	action,
	fields,
}: LicenseFormRequest) => {
	const url = new URL(`/v1/licenses/${action}`, LICENSE_API_URL);
	const presentFields = Object.entries(fields).filter(
		([, value]) => value !== undefined,
	) as [string, string][];
	const body = new URLSearchParams(presentFields);
	const response = await fetch(url, {
		method: "POST",
		headers: { Accept: "application/json" },
		body,
	}).catch((cause: unknown) => {
		throw networkErrorOf(cause);
	});
	const text = await response.text();
	const parsedBody = parseJsonBody(text);
	const isBodyNotJson = typeof parsedBody !== "object" || parsedBody === null;
	if (isBodyNotJson) throw apiErrorOf(response.status, parsedBody);
	return parsedBody as Payload;
};

export const createHttp = (config: Config) => {
	const request = <Payload>(httpRequest: HttpRequest) =>
		sendRequest<Payload>(config, httpRequest);

	const getResource = async <Attributes>(path: string) => {
		const document = await request<JsonApiDocument<Attributes>>({ path });
		return document.data;
	};

	const getAll = async <Attributes>(
		path: string,
		query?: HttpQuery,
	): Promise<JsonApiResource<Attributes>[]> => {
		const pageNumber = Number(query?.["page[number]"] ?? 1);
		const pageQuery = {
			...query,
			"page[size]": PAGE_SIZE,
			"page[number]": pageNumber,
		};
		const collection = await request<JsonApiCollection<Attributes>>({
			path,
			query: pageQuery,
		});
		const lastPage = collection.meta?.page?.lastPage;
		const isLastPageReached = lastPage === undefined || pageNumber >= lastPage;
		if (isLastPageReached) return collection.data;
		const nextPageQuery = { ...query, "page[number]": pageNumber + 1 };
		const laterPages = await getAll<Attributes>(path, nextPageQuery);
		return [...collection.data, ...laterPages];
	};

	return { request, getResource, getAll };
};

export type Http = ReturnType<typeof createHttp>;
