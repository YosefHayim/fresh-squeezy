/**
 * Core public types for fresh-squeezy.
 *
 * These shapes are the integration contract with consuming products. Treat them
 * as public API surface — breaking changes require a major version bump.
 */

/**
 * Severity for validator findings.
 *
 * - `info`: benign observation (e.g. "store reachable").
 * - `warning`: likely misconfiguration that should be reviewed.
 * - `error`: the setup is wrong; consumers should fail CI.
 */
export type ValidationSeverity = "info" | "warning" | "error";

/**
 * Which Lemon Squeezy environment a validator ran against.
 * Mode is determined by which API key was used, not by a host switch.
 */
export type Mode = "test" | "live";

/**
 * A single finding surfaced by a validator.
 *
 * `code` is a stable identifier so consumers can match in CI or dashboards
 * without depending on `message` wording. `suggestedFix` is optional prose
 * pointing to the most likely remediation.
 */
export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  suggestedFix?: string;
  context?: Record<string, string | number | boolean | null>;
}

/**
 * Return shape for every validator.
 *
 * `ok` is `false` if any issue has `severity: "error"`. `mode` surfaces the
 * environment the validator actually talked to, so callers can detect
 * test/live confusion.
 */
export interface ValidationResult<T = unknown> {
  ok: boolean;
  mode: Mode;
  name: string;
  resource?: T;
  issues: ValidationIssue[];
}

/**
 * Aggregate doctor output. Composes the results of every individual validator
 * into one object suitable for CI exit-code decisions, dashboards, or JSON logs.
 */
export interface DoctorReport {
  ok: boolean;
  mode: Mode;
  results: ValidationResult[];
}

/**
 * Options used when constructing the client.
 * Every field has an env-based default so consumers can use `createFreshSqueezy()`
 * with no arguments for the common case.
 */
export interface FreshSqueezyConfig {
  apiKey?: string;
  storeId?: string | number;
  mode?: Mode;
  baseUrl?: string;
  fetch?: typeof fetch;
}

/**
 * Resolved config after env + defaults are applied. Internal — not exported
 * from the package root.
 */
export interface ResolvedConfig {
  apiKey: string;
  storeId?: string;
  mode: Mode;
  baseUrl: string;
  fetch: typeof fetch;
}

/**
 * JSON:API resource envelope returned by the Lemon Squeezy main API.
 *
 * The shape is documented at https://jsonapi.org/ and covers the subset
 * fresh-squeezy relies on.
 */
export interface JsonApiResource<TAttributes = Record<string, unknown>> {
  type: string;
  id: string;
  attributes: TAttributes;
  relationships?: Record<string, unknown>;
  links?: Record<string, string>;
}

/**
 * JSON:API top-level document for single-resource responses.
 */
export interface JsonApiDocument<TAttributes = Record<string, unknown>> {
  data: JsonApiResource<TAttributes>;
  links?: Record<string, string>;
  meta?: Record<string, unknown>;
}

/**
 * JSON:API top-level document for collection responses.
 */
export interface JsonApiCollection<TAttributes = Record<string, unknown>> {
  data: JsonApiResource<TAttributes>[];
  links?: Record<string, string>;
  meta?: { page?: { currentPage: number; lastPage: number; total: number } };
}
