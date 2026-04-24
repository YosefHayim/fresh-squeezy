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
   * Fetch a JSON:API collection and return its `data` array.
   * Pagination is the caller's responsibility — use `meta.page` on the raw
   * request for multi-page traversal.
   */
  async getCollection<TAttr>(
    path: string,
    query?: RequestOptions["query"]
  ): Promise<JsonApiResource<TAttr>[]> {
    const doc = await this.request<JsonApiCollection<TAttr>>({ path, query });
    return doc.data;
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
