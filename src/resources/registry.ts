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
 * Implemented ops. Keep in sync with exports in `src/resources/*` and the
 * CLI dispatcher. Do not register fantasy endpoints (e.g. product create).
 */
export const resourceRegistry: readonly ResourceVerbSpec[] = [
  // users
  { resource: "user", verb: "get", docsPath: "users/retrieve-user", body: "none", idRole: "none" },

  // stores (read-only)
  { resource: "store", verb: "get", docsPath: "stores/retrieve-store", body: "none", idRole: "id" },
  {
    resource: "store",
    verb: "list",
    docsPath: "stores/list-all-stores",
    body: "none",
    idRole: "none",
  },

  // products (read-only)
  {
    resource: "product",
    verb: "get",
    docsPath: "products/retrieve-product",
    body: "none",
    idRole: "id",
  },
  {
    resource: "product",
    verb: "list",
    docsPath: "products/list-all-products",
    body: "none",
    idRole: "store",
  },

  // variants (read-only)
  {
    resource: "variant",
    verb: "get",
    docsPath: "variants/retrieve-variant",
    body: "none",
    idRole: "id",
  },
  {
    resource: "variant",
    verb: "list",
    docsPath: "variants/list-all-variants",
    body: "none",
    idRole: "parent",
  },

  // prices (read-only)
  { resource: "price", verb: "get", docsPath: "prices/retrieve-price", body: "none", idRole: "id" },
  {
    resource: "price",
    verb: "list",
    docsPath: "prices/list-all-prices",
    body: "none",
    idRole: "parent",
  },

  // files (read-only)
  { resource: "file", verb: "get", docsPath: "files/retrieve-file", body: "none", idRole: "id" },
  {
    resource: "file",
    verb: "list",
    docsPath: "files/list-all-files",
    body: "none",
    idRole: "parent",
  },

  // customers
  {
    resource: "customer",
    verb: "get",
    docsPath: "customers/retrieve-customer",
    body: "none",
    idRole: "id",
  },
  {
    resource: "customer",
    verb: "list",
    docsPath: "customers/list-all-customers",
    body: "none",
    idRole: "store",
  },
  {
    resource: "customer",
    verb: "create",
    docsPath: "customers/create-customer",
    body: "required",
    idRole: "none",
  },
  {
    resource: "customer",
    verb: "update",
    docsPath: "customers/update-customer",
    body: "required",
    idRole: "id",
  },

  // orders
  { resource: "order", verb: "get", docsPath: "orders/retrieve-order", body: "none", idRole: "id" },
  {
    resource: "order",
    verb: "list",
    docsPath: "orders/list-all-orders",
    body: "none",
    idRole: "store",
  },
  {
    resource: "order",
    verb: "refund",
    docsPath: "orders/issue-refund",
    body: "optional",
    destructive: true,
    idRole: "id",
  },
  {
    resource: "order",
    verb: "generate-invoice",
    docsPath: "orders/generate-order-invoice",
    body: "optional",
    idRole: "id",
  },

  // order-items (read-only)
  {
    resource: "order-item",
    verb: "get",
    docsPath: "order-items/retrieve-order-item",
    body: "none",
    idRole: "id",
  },
  {
    resource: "order-item",
    verb: "list",
    docsPath: "order-items/list-all-order-items",
    body: "none",
    idRole: "parent",
  },

  // subscriptions
  {
    resource: "subscription",
    verb: "get",
    docsPath: "subscriptions/retrieve-subscription",
    body: "none",
    idRole: "id",
  },
  {
    resource: "subscription",
    verb: "list",
    docsPath: "subscriptions/list-all-subscriptions",
    body: "none",
    idRole: "store",
  },
  {
    resource: "subscription",
    verb: "update",
    docsPath: "subscriptions/update-subscription",
    body: "required",
    idRole: "id",
  },
  {
    resource: "subscription",
    verb: "cancel",
    docsPath: "subscriptions/cancel-subscription",
    body: "none",
    destructive: true,
    idRole: "id",
  },

  // subscription-items
  {
    resource: "subscription-item",
    verb: "get",
    docsPath: "subscription-items/retrieve-subscription-item",
    body: "none",
    idRole: "id",
  },
  {
    resource: "subscription-item",
    verb: "list",
    docsPath: "subscription-items/list-all-subscription-items",
    body: "none",
    idRole: "parent",
  },
  {
    resource: "subscription-item",
    verb: "update",
    docsPath: "subscription-items/update-subscription-item",
    body: "required",
    idRole: "id",
  },
  {
    resource: "subscription-item",
    verb: "current-usage",
    docsPath: "subscription-items/retrieve-subscription-item-current-usage",
    body: "none",
    idRole: "id",
  },

  // subscription-invoices
  {
    resource: "subscription-invoice",
    verb: "get",
    docsPath: "subscription-invoices/retrieve-subscription-invoice",
    body: "none",
    idRole: "id",
  },
  {
    resource: "subscription-invoice",
    verb: "list",
    docsPath: "subscription-invoices/list-all-subscription-invoices",
    body: "none",
    idRole: "parent",
  },
  {
    resource: "subscription-invoice",
    verb: "refund",
    docsPath: "subscription-invoices/issue-refund",
    body: "optional",
    destructive: true,
    idRole: "id",
  },
  {
    resource: "subscription-invoice",
    verb: "generate-invoice",
    docsPath: "subscription-invoices/generate-subscription-invoice",
    body: "optional",
    idRole: "id",
  },

  // usage-records
  {
    resource: "usage-record",
    verb: "get",
    docsPath: "usage-records/retrieve-usage-record",
    body: "none",
    idRole: "id",
  },
  {
    resource: "usage-record",
    verb: "list",
    docsPath: "usage-records/list-all-usage-records",
    body: "none",
    idRole: "parent",
  },
  {
    resource: "usage-record",
    verb: "create",
    docsPath: "usage-records/create-usage-record",
    body: "required",
    idRole: "none",
  },

  // discounts
  {
    resource: "discount",
    verb: "get",
    docsPath: "discounts/retrieve-discount",
    body: "none",
    idRole: "id",
  },
  {
    resource: "discount",
    verb: "list",
    docsPath: "discounts/list-all-discounts",
    body: "none",
    idRole: "store",
  },
  {
    resource: "discount",
    verb: "create",
    docsPath: "discounts/create-discount",
    body: "required",
    idRole: "none",
  },
  {
    resource: "discount",
    verb: "delete",
    docsPath: "discounts/delete-discount",
    body: "none",
    destructive: true,
    idRole: "id",
  },

  // discount-redemptions (read-only)
  {
    resource: "discount-redemption",
    verb: "get",
    docsPath: "discount-redemptions/retrieve-discount-redemption",
    body: "none",
    idRole: "id",
  },
  {
    resource: "discount-redemption",
    verb: "list",
    docsPath: "discount-redemptions/list-all-discount-redemptions",
    body: "none",
    idRole: "parent",
  },

  // license-keys
  {
    resource: "license-key",
    verb: "get",
    docsPath: "license-keys/retrieve-license-key",
    body: "none",
    idRole: "id",
  },
  {
    resource: "license-key",
    verb: "list",
    docsPath: "license-keys/list-all-license-keys",
    body: "none",
    idRole: "store",
  },
  {
    resource: "license-key",
    verb: "update",
    docsPath: "license-keys/update-license-key",
    body: "required",
    idRole: "id",
  },

  // license-key-instances (read-only)
  {
    resource: "license-key-instance",
    verb: "get",
    docsPath: "license-key-instances/retrieve-license-key-instance",
    body: "none",
    idRole: "id",
  },
  {
    resource: "license-key-instance",
    verb: "list",
    docsPath: "license-key-instances/list-all-license-key-instances",
    body: "none",
    idRole: "parent",
  },

  // checkouts
  {
    resource: "checkout",
    verb: "get",
    docsPath: "checkouts/retrieve-checkout",
    body: "none",
    idRole: "id",
  },
  {
    resource: "checkout",
    verb: "list",
    docsPath: "checkouts/list-all-checkouts",
    body: "none",
    idRole: "store",
  },
  {
    resource: "checkout",
    verb: "create",
    docsPath: "checkouts/create-checkout",
    body: "required",
    idRole: "none",
  },

  // webhooks
  {
    resource: "webhook",
    verb: "get",
    docsPath: "webhooks/retrieve-webhook",
    body: "none",
    idRole: "id",
  },
  {
    resource: "webhook",
    verb: "list",
    docsPath: "webhooks/list-all-webhooks",
    body: "none",
    idRole: "store",
  },
  {
    resource: "webhook",
    verb: "create",
    docsPath: "webhooks/create-webhook",
    body: "required",
    idRole: "none",
  },
  {
    resource: "webhook",
    verb: "update",
    docsPath: "webhooks/update-webhook",
    body: "required",
    idRole: "id",
  },
  {
    resource: "webhook",
    verb: "delete",
    docsPath: "webhooks/delete-webhook",
    body: "none",
    destructive: true,
    idRole: "id",
  },

  // affiliates (read-only)
  {
    resource: "affiliate",
    verb: "get",
    docsPath: "affiliates/retrieve-affiliate",
    body: "none",
    idRole: "id",
  },
  {
    resource: "affiliate",
    verb: "list",
    docsPath: "affiliates/list-all-affiliates",
    body: "none",
    idRole: "store",
  },
] as const;

/**
 * Plural CLI tokens → singular registry keys.
 * Lookups run after `_` → `-` normalization, so only kebab forms live here.
 */
const RESOURCE_ALIASES: Record<string, string> = {
  products: "product",
  stores: "store",
  customers: "customer",
  orders: "order",
  "order-items": "order-item",
  subscriptions: "subscription",
  "subscription-items": "subscription-item",
  "subscription-invoices": "subscription-invoice",
  "usage-records": "usage-record",
  discounts: "discount",
  "discount-redemptions": "discount-redemption",
  "license-keys": "license-key",
  "license-key-instances": "license-key-instance",
  checkouts: "checkout",
  webhooks: "webhook",
  affiliates: "affiliate",
  variants: "variant",
  prices: "price",
  files: "file",
  users: "user",
};

/**
 * Normalize a CLI resource token to the singular registry key.
 *
 * @param resource - Raw token (`products`, `order_items`, `webhook`).
 * @returns Canonical singular resource name used in `resourceRegistry`.
 */
export const normalizeResourceName = (resource: string): string => {
  const normalized = resource.replace(/_/g, "-").toLowerCase();
  if (RESOURCE_ALIASES[normalized]) {
    return RESOURCE_ALIASES[normalized];
  }
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
