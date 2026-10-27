import type {
	JsonApiCollection,
	JsonApiDocument,
	JsonApiResource,
	ResolvedConfig,
} from "@/shared/contracts.js";
import {
	type FreshSqueezyError,
	freshSqueezyErrorOf,
} from "@/shared/errors.js";

const HTTP_STATUS_CODES = {
	401: "UNAUTHORIZED",
	404: "NOT_FOUND",
	429: "RATE_LIMITED",
} as const;

export interface RequestOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	path: string;
	query?: Record<string, string | number | undefined>;
	body?: unknown;
	signal?: AbortSignal;
}

interface JsonApiError {
	status?: string;
	code?: string;
	title?: string;
	detail?: string;
}

export class HttpClient {
	constructor(readonly config: ResolvedConfig) {}

	async request<T>(options: RequestOptions): Promise<T> {
		const url = requestUrlOf(this.config, options.path, options.query);
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.apiKey}`,
			Accept: "application/vnd.api+json",
		};
		const hasBody = options.body !== undefined;
		if (hasBody) {
			headers["Content-Type"] = "application/vnd.api+json";
		}

		let httpResponse: Response;
		try {
			httpResponse = await this.config.fetch(url, {
				method: options.method ?? "GET",
				headers,
				body: hasBody ? JSON.stringify(options.body) : undefined,
				signal: options.signal,
			});
		} catch (cause) {
			const isCauseAnError = cause instanceof Error;
			throw freshSqueezyErrorOf({
				code: "NETWORK_ERROR",
				message: isCauseAnError ? cause.message : "Network request failed",
				detail: cause,
			});
		}

		const text = await httpResponse.text();
		const isBodyPresent = text.length > 0;
		const parsed = isBodyPresent ? parseJsonBody(text) : undefined;

		const isResponseFailed = !httpResponse.ok;
		if (isResponseFailed) {
			throw apiError(httpResponse.status, parsed);
		}

		return parsed as T;
	}

	async getResource<TAttr>(path: string): Promise<JsonApiResource<TAttr>> {
		const doc = await this.request<JsonApiDocument<TAttr>>({ path });
		return doc.data;
	}

	async paginate<TAttr>(
		path: string,
		query?: RequestOptions["query"],
	): Promise<JsonApiResource<TAttr>[]> {
		const startPage = Number(query?.["page[number]"] ?? 1);
		const all: JsonApiResource<TAttr>[] = [];

		let pageNumber = startPage;
		while (true) {
			const pagedQuery = { ...(query ?? {}), "page[number]": pageNumber };
			const doc = await this.request<JsonApiCollection<TAttr>>({
				path,
				query: pagedQuery,
			});
			all.push(...doc.data);

			const lastPage = doc.meta?.page?.lastPage;
			const isLastPageReached =
				lastPage === undefined || pageNumber >= lastPage;
			if (isLastPageReached) return all;
			pageNumber += 1;
		}
	}
}

const requestUrlOf = (
	config: ResolvedConfig,
	path: string,
	query?: RequestOptions["query"],
): string => {
	const url = new URL(path, config.baseUrl);
	const queryEntries = Object.entries(query ?? {});
	for (const [key, value] of queryEntries) {
		const isValueMissing = value === undefined;
		if (isValueMissing) continue;
		const queryValue = String(value);
		url.searchParams.append(key, queryValue);
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

const apiError = (status: number, responseBody: unknown): FreshSqueezyError => {
	const errors = extractJsonApiErrors(responseBody);
	const first = errors[0];
	const mapped = HTTP_STATUS_CODES[status as keyof typeof HTTP_STATUS_CODES];
	const code = mapped ?? first?.code ?? `HTTP_${status}`;
	const message =
		first?.detail ??
		first?.title ??
		`Lemon Squeezy request failed with status ${status}`;
	return freshSqueezyErrorOf({ code, status, message, detail: responseBody });
};

const extractJsonApiErrors = (responseBody: unknown): JsonApiError[] => {
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
