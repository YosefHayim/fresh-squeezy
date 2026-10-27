import type { Config } from "./config.js";
import { buildFreshSqueezyError, type FreshSqueezyError } from "./errors.js";

const PAGE_SIZE = 100;

const LICENSE_API_URL = "https://api.lemonsqueezy.com";

const API_CONTENT_TYPE = "application/vnd.api+json";

const ERROR_CODES_BY_STATUS = new Map([
	[401, "UNAUTHORIZED"],
	[404, "NOT_FOUND"],
	[429, "RATE_LIMITED"],
]);

export type HttpQuery = Record<string, string | number | undefined>;

export interface HttpRequest {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	path: string;
	query?: HttpQuery;
	document?: unknown;
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

const buildRequestUrl = (config: Config, path: string, query?: HttpQuery) => {
	const url = new URL(path, config.baseUrl);
	const queryEntries = Object.entries(query ?? {});
	for (const [queryName, queryValue] of queryEntries) {
		const isQueryValueMissing = queryValue === undefined;
		if (isQueryValueMissing) continue;
		const queryValueText = String(queryValue);
		url.searchParams.append(queryName, queryValueText);
	}
	return url.toString();
};

const parseReplyText = (replyText: string): unknown => {
	try {
		return JSON.parse(replyText);
	} catch {
		return replyText;
	}
};

const isJsonObject = (replyDocument: unknown): replyDocument is object =>
	typeof replyDocument === "object" && replyDocument !== null;

const isJsonApiError = (apiError: unknown): apiError is JsonApiError =>
	isJsonObject(apiError);

const hasErrorList = (
	replyDocument: unknown,
): replyDocument is { errors: unknown[] } =>
	isJsonObject(replyDocument) &&
	"errors" in replyDocument &&
	Array.isArray(replyDocument.errors);

const readJsonApiErrors = (replyDocument: unknown): JsonApiError[] => {
	const isErrorListMissing = !hasErrorList(replyDocument);
	if (isErrorListMissing) return [];
	return replyDocument.errors.filter(isJsonApiError);
};

const buildApiError = (
	status: number,
	replyDocument: unknown,
): FreshSqueezyError => {
	const [firstError] = readJsonApiErrors(replyDocument);
	const statusErrorCode = ERROR_CODES_BY_STATUS.get(status);
	const code = statusErrorCode ?? firstError?.code ?? `HTTP_${status}`;
	const message =
		firstError?.detail ??
		firstError?.title ??
		`Lemon Squeezy request failed with status ${status}`;
	return buildFreshSqueezyError({
		code,
		status,
		message,
		detail: replyDocument,
	});
};

const buildNetworkError = (cause: unknown) => {
	const isCauseAnError = cause instanceof Error;
	const message = isCauseAnError ? cause.message : "Network request failed";
	return buildFreshSqueezyError({
		code: "NETWORK_ERROR",
		message,
		detail: cause,
	});
};

const sendRequest = async <ReplyDocument>(
	config: Config,
	{ method = "GET", path, query, document, signal }: HttpRequest,
) => {
	const url = buildRequestUrl(config, path, query);
	const headers: Record<string, string> = {
		Authorization: `Bearer ${config.apiKey}`,
		Accept: API_CONTENT_TYPE,
	};
	const hasDocument = document !== undefined;
	if (hasDocument) headers["Content-Type"] = API_CONTENT_TYPE;

	const documentText = hasDocument ? JSON.stringify(document) : undefined;
	const reply = await config
		.fetch(url, { method, headers, body: documentText, signal })
		.catch((cause: unknown) => {
			throw buildNetworkError(cause);
		});

	const replyText = await reply.text();
	const hasReplyText = replyText.length > 0;
	const replyDocument = hasReplyText ? parseReplyText(replyText) : undefined;
	const isReplyFailed = !reply.ok;
	if (isReplyFailed) throw buildApiError(reply.status, replyDocument);
	// The one place a reply gets its type; the live API check keeps the types honest.
	return replyDocument as ReplyDocument;
};

export interface LicenseFormRequest {
	action: "activate" | "validate" | "deactivate";
	fields: Record<string, string | undefined>;
}

const isFieldFilled = (
	field: [string, string | undefined],
): field is [string, string] => field[1] !== undefined;

// The license API takes no API key and answers 4xx with a JSON body that carries `error`.
export const postLicenseForm = async <LicenseReply>({
	action,
	fields,
}: LicenseFormRequest) => {
	const url = new URL(`/v1/licenses/${action}`, LICENSE_API_URL);
	const fieldEntries = Object.entries(fields);
	const filledFields = fieldEntries.filter(isFieldFilled);
	const licenseForm = new URLSearchParams(filledFields);
	const reply = await fetch(url, {
		method: "POST",
		headers: { Accept: "application/json" },
		body: licenseForm,
	}).catch((cause: unknown) => {
		throw buildNetworkError(cause);
	});
	const replyText = await reply.text();
	const licenseReply = parseReplyText(replyText);
	const isLicenseReplyNotJson = !isJsonObject(licenseReply);
	if (isLicenseReplyNotJson) throw buildApiError(reply.status, licenseReply);
	return licenseReply as LicenseReply;
};

export const createHttp = (config: Config) => {
	const request = <ReplyDocument>(httpRequest: HttpRequest) =>
		sendRequest<ReplyDocument>(config, httpRequest);

	const getResource = async <Attributes>(path: string) => {
		const resourceDocument = await request<JsonApiDocument<Attributes>>({
			path,
		});
		return resourceDocument.data;
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
