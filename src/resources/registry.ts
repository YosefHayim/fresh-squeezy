import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient, RequestOptions } from "../core/http.js";
import type { JsonApiDocument } from "../core/types.js";
import type { UserAttributes } from "./attributes.js";

/**
 * Docs-backed ops matrix for Lemon Squeezy.
 *
 * Only verbs that exist at https://docs.lemonsqueezy.com/api are listed.
 * Catalog resources (products, variants, prices, files, stores, …) are
 * read-only. CI changelog scrape may propose gaps; this registry is what ships.
 */

/** CLI / client verb tokens, including non-CRUD LS actions. */
export type OpVerb =
  | "get"
  | "list"
  | "create"
  | "update"
  | "delete"
  | "cancel"
  | "refund"
  | "generate-invoice"
  | "current-usage";

/**
 * One implemented, documented operation.
 *
 * @remarks `docsPath` is the path under `/api/` on the LS docs site.
 */
export interface ResourceVerbSpec {
  /** CLI resource token (singular), e.g. `webhook`. */
  resource: string;
  verb: OpVerb;
  /** Docs path fragment, e.g. `webhooks/create-webhook`. */
  docsPath: string;
  /** Requires --yes or TTY confirm always (delete/cancel/refund). */
  destructive?: boolean;
  body?: "required" | "optional" | "none";
  /**
   * How list/get resolve the primary id filter.
   * - `id` — --id
   * - `store` — --store-ids (first) or store filter
   * - `parent` — --parent-id (subscription, order, product, …)
   */
  idRole?: "id" | "store" | "parent" | "none";
}

/**
 * Arguments for a single resource op invocation.
 *
 * One named input type — not a bag of unrelated returns.
 */
export interface InvokeOpArgs {
  id?: string | number;
  storeId?: string | number;
  parentId?: string | number;
  body?: unknown;
}

interface VerbRule {
  method: NonNullable<RequestOptions["method"]>;
  /** Appended to `/v1/<resource>s`; `{id}` is replaced by `--id`. */
  path: string;
  /** Docs page slug; `{r}` is replaced by the resource name. */
  docs: string;
  body: NonNullable<ResourceVerbSpec["body"]>;
  destructive?: true;
}

/** Every Lemon Squeezy verb always maps to the same HTTP call shape and docs page name. */
const VERB_RULES: Record<OpVerb, VerbRule> = {
  get: { method: "GET", path: "/{id}", docs: "retrieve-{r}", body: "none" },
  list: { method: "GET", path: "", docs: "list-all-{r}s", body: "none" },
  create: { method: "POST", path: "", docs: "create-{r}", body: "required" },
  update: { method: "PATCH", path: "/{id}", docs: "update-{r}", body: "required" },
  delete: { method: "DELETE", path: "/{id}", docs: "delete-{r}", body: "none", destructive: true },
  cancel: { method: "DELETE", path: "/{id}", docs: "cancel-{r}", body: "none", destructive: true },
  refund: {
    method: "POST",
    path: "/{id}/refund",
    docs: "issue-refund",
    body: "optional",
    destructive: true,
  },
  "generate-invoice": {
    method: "POST",
    path: "/{id}/generate-invoice",
    docs: "generate-{r}-invoice",
    body: "optional",
  },
  "current-usage": {
    method: "GET",
    path: "/{id}/current-usage",
    docs: "retrieve-{r}-current-usage",
    body: "none",
  },
};

/** `listScope` is what filters `list`: `"store"` → `--store-ids`, a resource → `--parent-id`. */
type ResourceRow = [resource: string, verbs: OpVerb[], listScope?: string];

/**
 * Implemented ops per resource, in the order `ops --list` prints them. Do not
 * register fantasy endpoints (e.g. product create).
 */
const RESOURCES: ResourceRow[] = [
  ["user", ["get"]],
  ["store", ["get", "list"]],
  ["product", ["get", "list"], "store"],
  ["variant", ["get", "list"], "product"],
  ["price", ["get", "list"], "variant"],
  ["file", ["get", "list"], "variant"],
  ["customer", ["get", "list", "create", "update"], "store"],
  ["order", ["get", "list", "refund", "generate-invoice"], "store"],
  ["order-item", ["get", "list"], "order"],
  ["subscription", ["get", "list", "update", "cancel"], "store"],
  ["subscription-item", ["get", "list", "update", "current-usage"], "subscription"],
  ["subscription-invoice", ["get", "list", "refund", "generate-invoice"], "subscription"],
  ["usage-record", ["get", "list", "create"], "subscription-item"],
  ["discount", ["get", "list", "create", "delete"], "store"],
  ["discount-redemption", ["get", "list"], "discount"],
  ["license-key", ["get", "list", "update"], "store"],
  ["license-key-instance", ["get", "list"], "license-key"],
  ["checkout", ["get", "list", "create"], "store"],
  ["webhook", ["get", "list", "create", "update", "delete"], "store"],
  ["affiliate", ["get", "list"], "store"],
];

/** The one docs page that breaks the `generate-{r}-invoice` naming pattern. */
const DOCS_PATH_EXCEPTIONS: Record<string, string> = {
  "subscription-invoice:generate-invoice": "subscription-invoices/generate-subscription-invoice",
};

const USER_ME_PATH = "/v1/users/me";

const listIdRole = (listScope: string | undefined): ResourceVerbSpec["idRole"] => {
  if (!listScope) return "none";
  return listScope === "store" ? "store" : "parent";
};

const toSpec = (resource: string, verb: OpVerb, listScope?: string): ResourceVerbSpec => {
  const rule = VERB_RULES[verb];
  const docsPath =
    DOCS_PATH_EXCEPTIONS[`${resource}:${verb}`] ??
    `${resource}s/${rule.docs.replaceAll("{r}", resource)}`;
  let idRole: ResourceVerbSpec["idRole"] = rule.path.includes("{id}") ? "id" : "none";
  if (verb === "list") idRole = listIdRole(listScope);
  if (resource === "user") idRole = "none";
  return {
    resource,
    verb,
    docsPath,
    body: rule.body,
    ...(rule.destructive ? { destructive: true } : {}),
    idRole,
  };
};

/**
 * Implemented ops, one entry per documented resource verb. Keep in sync with
 * the nested client in `createFreshSqueezy`.
 */
export const resourceRegistry: readonly ResourceVerbSpec[] = RESOURCES.flatMap(
  ([resource, verbs, listScope]) => verbs.map((verb) => toSpec(resource, verb, listScope)),
);

/**
 * Normalize a CLI resource token to the singular registry key.
 *
 * @param resource - Raw token (`products`, `order_items`, `webhook`).
 * @returns Canonical singular resource name used in `resourceRegistry`.
 */
export const normalizeResourceName = (resource: string): string => {
  const normalized = resource.replace(/_/g, "-").toLowerCase();
  // naive singular for simple plurals; leave tokens like "status" alone
  if (normalized.endsWith("s") && normalized !== "status") {
    return normalized.slice(0, -1);
  }
  return normalized;
};

/**
 * Look up a registry entry.
 *
 * @param resource - CLI resource token.
 * @param verb - Op verb.
 * @returns The spec, or undefined when not implemented / not in LS API.
 */
export const findResourceVerb = (resource: string, verb: string): ResourceVerbSpec | undefined => {
  const key = normalizeResourceName(resource);
  return resourceRegistry.find((entry) => entry.resource === key && entry.verb === verb);
};

/**
 * Unique resource names that have at least one verb.
 *
 * @returns Sorted resource tokens for help text / menus.
 */
export const listRegisteredResources = (): string[] => {
  return [...new Set(resourceRegistry.map((entry) => entry.resource))].sort();
};

/**
 * All verbs registered for a resource (empty when unknown).
 *
 * @param resource - CLI resource token (plural or singular).
 * @returns Sorted verb list for help / menus.
 */
export const listRegisteredVerbs = (resource: string): OpVerb[] => {
  const key = normalizeResourceName(resource);
  return resourceRegistry
    .filter((entry) => entry.resource === key)
    .map((entry) => entry.verb)
    .sort();
};

const requireId = (args: InvokeOpArgs, spec: ResourceVerbSpec): string | number => {
  if (args.id === undefined || args.id === "") {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: `--id is required for this ${spec.resource} operation.`,
    });
  }
  return args.id;
};

const requireStore = (args: InvokeOpArgs): string | number => {
  if (args.storeId === undefined || args.storeId === "") {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: "--store-ids (or store id) is required for this list operation.",
    });
  }
  return args.storeId;
};

const requireParent = (args: InvokeOpArgs, parent: string): string | number => {
  if (args.parentId === undefined || args.parentId === "") {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: `--parent-id (${parent} id) is required for this list operation.`,
    });
  }
  return args.parentId;
};

const requireBody = (args: InvokeOpArgs): unknown => {
  if (args.body === undefined) {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: "A JSON body is required (--body, --body-file, or stdin).",
    });
  }
  return args.body;
};

const listFilter = (spec: ResourceVerbSpec, args: InvokeOpArgs): RequestOptions["query"] => {
  const listScope = RESOURCES.find(([resource]) => resource === spec.resource)?.[2];
  if (!listScope) return undefined;
  const scopeId = listScope === "store" ? requireStore(args) : requireParent(args, listScope);
  return { [`filter[${listScope.replace(/-/g, "_")}_id]`]: String(scopeId) };
};

const requestBody = (rule: VerbRule, args: InvokeOpArgs): unknown => {
  if (rule.body === "required") return requireBody(args);
  if (rule.body === "optional") return args.body ?? {};
  return undefined;
};

/**
 * Run a docs-backed resource verb: look it up in `resourceRegistry`, then make
 * the one HTTP call its verb rule describes.
 *
 * @param http - Shared API client.
 * @param resource - CLI resource token (`webhook`, `product`, …).
 * @param verb - Op verb (`get`, `create`, `refund`, …).
 * @param args - Ids / body for the call.
 * @returns The JSON:API `data` (resource or list), the whole document for
 * endpoints that return only `meta` (invoices, usage), or undefined after a delete.
 * @throws {FreshSqueezyError} When the verb is unknown, an argument is missing, or HTTP fails.
 *
 * @example
 * ```ts
 * const product = await invokeOp(http, "product", "get", { id: 42 });
 * // GET /v1/products/42
 * ```
 */
export const invokeOp = async (
  http: HttpClient,
  resource: string,
  verb: OpVerb | string,
  args: InvokeOpArgs = {},
): Promise<unknown> => {
  const spec = findResourceVerb(resource, verb);
  if (!spec) {
    throw new FreshSqueezyError({
      code: "UNKNOWN_OP",
      message: `Unknown or unsupported op: ${verb} ${resource}. Run \`fresh-squeezy ops --list\`.`,
    });
  }

  if (spec.resource === "user") {
    const doc = await http.request<JsonApiDocument<UserAttributes>>({ path: USER_ME_PATH });
    return doc.data;
  }

  const collectionPath = `/v1/${spec.resource}s`;
  if (spec.verb === "list") {
    return http.paginate(collectionPath, listFilter(spec, args));
  }

  const rule = VERB_RULES[spec.verb];
  const path = collectionPath + rule.path.replace("{id}", () => String(requireId(args, spec)));
  const doc = await http.request<{ data?: unknown } | undefined>({
    method: rule.method,
    path,
    body: requestBody(rule, args),
  });
  return doc?.data ?? doc;
};
