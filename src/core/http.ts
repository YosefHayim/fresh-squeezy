import { type FreshSqueezyError, freshSqueezyErrorOf } from "./errors.js";
import type {
	JsonApiCollection,
	JsonApiDocument,
	JsonApiResource,
	ResolvedConfig,
} from "./types.js";

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
	constructor(private readonly config: ResolvedConfig) {}

	async request<T>(options: RequestOptions): Promise<T> {
		const url = this.requestUrl(options.path, options.query);
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.apiKey}`,
			Accept: "application/vnd.api+json",
		};
		if (options.body !== undefined) {
			headers["Content-Type"] = "application/vnd.api+json";
		}

		let httpResponse: Response;
		try {
			httpResponse = await this.config.fetch(url, {
				method: options.method ?? "GET",
				headers,
				body:
					options.body === undefined ? undefined : JSON.stringify(options.body),
				signal: options.signal,
			});
		} catch (cause) {
			throw freshSqueezyErrorOf({
				code: "NETWORK_ERROR",
				message:
					cause instanceof Error ? cause.message : "Network request failed",
				detail: cause,
			});
		}

		const text = await httpResponse.text();
		const parsed = text.length > 0 ? parseJsonBody(text) : undefined;

		if (!httpResponse.ok) {
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
			if (lastPage === undefined || pageNumber >= lastPage) return all;
			pageNumber += 1;
		}
	}

	private requestUrl(path: string, query?: RequestOptions["query"]): string {
		const url = new URL(path, this.config.baseUrl);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value === undefined) continue;
				url.searchParams.append(key, String(value));
			}
		}
		return url.toString();
	}
}

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
	if (!responseBody || typeof responseBody !== "object") return [];
	const errors = (responseBody as { errors?: unknown }).errors;
	if (!Array.isArray(errors)) return [];
	return errors.filter(
		(entry): entry is JsonApiError =>
			typeof entry === "object" && entry !== null,
	);
};
