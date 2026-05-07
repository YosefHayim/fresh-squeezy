import { FreshSqueezyError } from "./errors.js";
import type {
  JsonApiCollection,
  JsonApiDocument,
  JsonApiResource,
  ResolvedConfig,
} from "./types.js";

/**
 * Options for a single HTTP request.
 *
 * `path` is a Lemon Squeezy API path starting with `/v1/...`. The `query`
 * record is serialized as URL search params with JSON:API-style bracketed
 * keys left untouched (e.g. `filter[store_id]`).
 */
export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * Lemon Squeezy JSON:API error object. Kept loose because the API occasionally
 * includes extra keys; the fields we surface are the stable ones.
 */
interface JsonApiError {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
}

/**
 * Low-level HTTP client. Callers usually go through resource/validator helpers,
 * but this is also exposed as the public escape hatch so consumers can reach
 * endpoints fresh-squeezy does not wrap yet.
 *
 * Responsibilities kept in this one place (per plan.md "one source of truth
 * for transport"):
 *   - auth header injection
 *   - query string serialization with JSON:API bracket keys preserved
 *   - response parsing + error normalization
 *   - surfacing HTTP status in `FreshSqueezyError`
 *
 * Retries, pagination helpers, and rate-limit handling live in separate files
 * so this layer stays small and obvious.
 */
export class HttpClient {
  constructor(private readonly config: ResolvedConfig) {}

  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      Accept: "application/vnd.api+json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/vnd.api+json";
    }

    let response: Response;
    try {
      response = await this.config.fetch(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (cause) {
      throw new FreshSqueezyError({
        code: "NETWORK_ERROR",
        message: cause instanceof Error ? cause.message : "Network request failed",
        detail: cause,
      });
    }

    const text = await response.text();
    const parsed = text.length > 0 ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw toApiError(response.status, parsed);
    }

    return parsed as T;
  }

  /**
   * Fetch a single JSON:API resource and return its `data` object.
   */
  async getResource<TAttr>(path: string): Promise<JsonApiResource<TAttr>> {
    const doc = await this.request<JsonApiDocument<TAttr>>({ path });
    return doc.data;
  }

  /**
   * Fetch a single page of a JSON:API collection. Most callers want
   * `paginate()` instead — this method is kept for one-shot lookups where
   * the caller knows the result fits in a single page.
   */
  async getCollection<TAttr>(
    path: string,
    query?: RequestOptions["query"]
  ): Promise<JsonApiResource<TAttr>[]> {
    const doc = await this.request<JsonApiCollection<TAttr>>({ path, query });
    return doc.data;
  }

  /**
   * Walk a JSON:API collection across every page and concatenate the
   * results. Lemon Squeezy returns 25 items per page by default; without
   * pagination, validators silently miss anything past the first page (e.g.
   * `validateWebhook` on a store with 26+ webhooks would falsely report
   * `WEBHOOK_NOT_FOUND` for any webhook on page 2).
   *
   * Stops as soon as `meta.page.lastPage` is reached. Falls back to a
   * single-page fetch if the API does not surface page metadata.
   *
   * Caller-supplied `page[number]` is honored as the starting page; we
   * advance from there. `page[size]` is left untouched so callers can tune
   * batch size (max 100 per Lemon Squeezy docs).
   */
  async paginate<TAttr>(
    path: string,
    query?: RequestOptions["query"]
  ): Promise<JsonApiResource<TAttr>[]> {
    const startPage = Number(query?.["page[number]"] ?? 1)
    const all: JsonApiResource<TAttr>[] = [];

    let pageNumber = startPage;
    while (true) {
      const pagedQuery = { ...(query ?? {}), "page[number]": pageNumber };
      const doc = await this.request<JsonApiCollection<TAttr>>({ path, query: pagedQuery });
      all.push(...doc.data);

      const lastPage = doc.meta?.page?.lastPage;
      if (lastPage === undefined || pageNumber >= lastPage) return all;
      pageNumber += 1;
    }
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
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

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): FreshSqueezyError {
  const errors = extractJsonApiErrors(body);
  const first = errors[0];
  const code =
    status === 401
      ? "UNAUTHORIZED"
      : status === 404
        ? "NOT_FOUND"
        : status === 429
          ? "RATE_LIMITED"
          : (first?.code ?? `HTTP_${status}`);
  const message =
    first?.detail ?? first?.title ?? `Lemon Squeezy request failed with status ${status}`;
  return new FreshSqueezyError({ code, status, message, detail: body });
}

function extractJsonApiErrors(body: unknown): JsonApiError[] {
  if (!body || typeof body !== "object") return [];
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (entry): entry is JsonApiError => typeof entry === "object" && entry !== null
  );
}
