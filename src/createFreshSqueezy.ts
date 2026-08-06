import { resolveConfig } from "./core/config.js";
import { HttpClient, type RequestOptions } from "./core/http.js";
import type { DoctorReport, FreshSqueezyConfig, Mode, ValidationResult } from "./core/types.js";
import type { DiscountAttributes } from "./resources/discounts.js";
import { type InvokeOpArgs, invokeOp } from "./resources/invokeOp.js";
import type { LicenseKeyAttributes } from "./resources/licenseKeys.js";
import type { ProductAttributes } from "./resources/products.js";
import type { OpVerb } from "./resources/registry.js";
import type { StoreAttributes } from "./resources/stores.js";
import type { WebhookAttributes } from "./resources/webhooks.js";
import { type ConnectionSummary, validateConnection } from "./validate/connection.js";
import { type DiscountValidationOptions, validateDiscount } from "./validate/discount.js";
import { type DoctorOptions, doctor } from "./validate/doctor.js";
import { type LicenseKeyValidationOptions, validateLicenseKey } from "./validate/licenseKey.js";
import { type ProductValidationOptions, validateProduct } from "./validate/product.js";
import { validateStore } from "./validate/store.js";
import {
  type SubscriptionPlanSummary,
  type SubscriptionPlanValidationOptions,
  validateSubscriptionPlan,
} from "./validate/subscriptionPlan.js";
import { type WebhookValidationOptions, validateWebhook } from "./validate/webhook.js";

/**
 * Nested resource namespaces for docs-backed Lemon Squeezy ops.
 *
 * Every method routes through `invokeOp` + `resourceRegistry` (docsPath required).
 * Methods exist only when the official API documents them — no product/variant create.
 * Ops return JSON:API payloads as `unknown`; callers narrow or use resource helpers.
 * Failures throw `FreshSqueezyError` (branch on `.code`).
 */
export interface FreshSqueezyOps {
  users: {
    me: () => Promise<unknown>;
  };
  stores: {
    get: (id: string | number) => Promise<unknown>;
    list: () => Promise<unknown>;
  };
  products: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
  };
  variants: {
    get: (id: string | number) => Promise<unknown>;
    list: (productId: string | number) => Promise<unknown>;
  };
  prices: {
    get: (id: string | number) => Promise<unknown>;
    list: (variantId: string | number) => Promise<unknown>;
  };
  files: {
    get: (id: string | number) => Promise<unknown>;
    list: (variantId: string | number) => Promise<unknown>;
  };
  customers: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
    create: (body: unknown) => Promise<unknown>;
    update: (id: string | number, body: unknown) => Promise<unknown>;
  };
  orders: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
    refund: (id: string | number, body?: unknown) => Promise<unknown>;
    generateInvoice: (id: string | number, body?: unknown) => Promise<unknown>;
  };
  orderItems: {
    get: (id: string | number) => Promise<unknown>;
    list: (orderId: string | number) => Promise<unknown>;
  };
  subscriptions: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
    update: (id: string | number, body: unknown) => Promise<unknown>;
    cancel: (id: string | number) => Promise<unknown>;
  };
  subscriptionItems: {
    get: (id: string | number) => Promise<unknown>;
    list: (subscriptionId: string | number) => Promise<unknown>;
    update: (id: string | number, body: unknown) => Promise<unknown>;
    currentUsage: (id: string | number) => Promise<unknown>;
  };
  subscriptionInvoices: {
    get: (id: string | number) => Promise<unknown>;
    list: (subscriptionId: string | number) => Promise<unknown>;
    refund: (id: string | number, body?: unknown) => Promise<unknown>;
    generateInvoice: (id: string | number, body?: unknown) => Promise<unknown>;
  };
  usageRecords: {
    get: (id: string | number) => Promise<unknown>;
    list: (subscriptionItemId: string | number) => Promise<unknown>;
    create: (body: unknown) => Promise<unknown>;
  };
  discounts: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
    create: (body: unknown) => Promise<unknown>;
    delete: (id: string | number) => Promise<unknown>;
  };
  discountRedemptions: {
    get: (id: string | number) => Promise<unknown>;
    list: (discountId: string | number) => Promise<unknown>;
  };
  licenseKeys: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
    update: (id: string | number, body: unknown) => Promise<unknown>;
  };
  licenseKeyInstances: {
    get: (id: string | number) => Promise<unknown>;
    list: (licenseKeyId: string | number) => Promise<unknown>;
  };
  checkouts: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
    create: (body: unknown) => Promise<unknown>;
  };
  webhooks: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
    create: (body: unknown) => Promise<unknown>;
    update: (id: string | number, body: unknown) => Promise<unknown>;
    delete: (id: string | number) => Promise<unknown>;
  };
  affiliates: {
    get: (id: string | number) => Promise<unknown>;
    list: (storeId: string | number) => Promise<unknown>;
  };
}

/**
 * The public client. Validators stay flat; ops live under nested namespaces
 * that mirror docs-backed resources (see `resourceRegistry`).
 */
export interface FreshSqueezyClient extends FreshSqueezyOps {
  /** Resolved mode (test or live). Surfaced so consumers can log it. */
  readonly mode: Mode;

  /** Raw HTTP escape hatch for endpoints fresh-squeezy does not wrap. */
  request<T = unknown>(options: RequestOptions): Promise<T>;

  validateConnection(): Promise<ValidationResult<ConnectionSummary>>;
  validateStore(storeId: string | number): Promise<ValidationResult<StoreAttributes>>;
  validateProduct(options: ProductValidationOptions): Promise<ValidationResult<ProductAttributes>>;
  validateWebhook(options: WebhookValidationOptions): Promise<ValidationResult<WebhookAttributes>>;
  validateDiscount(
    options: DiscountValidationOptions,
  ): Promise<ValidationResult<DiscountAttributes>>;
  validateLicenseKey(
    options: LicenseKeyValidationOptions,
  ): Promise<ValidationResult<LicenseKeyAttributes>>;
  validateSubscriptionPlan(
    options: SubscriptionPlanValidationOptions,
  ): Promise<ValidationResult<SubscriptionPlanSummary>>;
  /**
   * Compose configured validators into one report.
   * Defaults `storeId` from client config when the call omits it.
   */
  doctor(options?: DoctorOptions): Promise<DoctorReport>;
}

/**
 * Create a fresh-squeezy client. Zero-config usage reads
 * `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, and `LEMON_SQUEEZY_MODE`
 * from `process.env`.
 *
 * @param config - Optional overrides for key, mode, store, fetch.
 * @returns Client with validators + nested docs-backed ops.
 * @throws {FreshSqueezyError} When config is invalid (missing key, bad mode).
 *
 * @example
 * ```ts
 * const lemon = createFreshSqueezy();
 * const report = await lemon.doctor();
 * if (!report.ok) process.exit(1);
 * const product = await lemon.products.get(42);
 * const webhook = await lemon.webhooks.create({ data: { type: "webhooks", … } });
 * ```
 */
export const createFreshSqueezy = (config: FreshSqueezyConfig = {}): FreshSqueezyClient => {
  const resolved = resolveConfig(config);
  const http = new HttpClient(resolved);

  /** Dispatch a registry-backed op; never invents endpoints outside `resourceRegistry`. */
  const op = (resource: string, verb: OpVerb, args: InvokeOpArgs = {}) =>
    invokeOp(http, resource, verb, args);

  return {
    mode: resolved.mode,
    request: (options) => http.request(options),
    validateConnection: () => validateConnection(http, resolved.mode),
    validateStore: (storeId) => validateStore(http, resolved.mode, storeId),
    validateProduct: (options) => validateProduct(http, resolved.mode, options),
    validateWebhook: (options) => validateWebhook(http, resolved.mode, options),
    validateDiscount: (options) => validateDiscount(http, resolved.mode, options),
    validateLicenseKey: (options) => validateLicenseKey(http, resolved.mode, options),
    validateSubscriptionPlan: (options) => validateSubscriptionPlan(http, resolved.mode, options),
    doctor: (options) =>
      doctor(http, resolved.mode, {
        ...options,
        storeId: options?.storeId ?? resolved.storeId,
      }),

    users: {
      me: () => op("user", "get"),
    },
    stores: {
      get: (id) => op("store", "get", { id }),
      list: () => op("store", "list"),
    },
    products: {
      get: (id) => op("product", "get", { id }),
      list: (storeId) => op("product", "list", { storeId }),
    },
    variants: {
      get: (id) => op("variant", "get", { id }),
      list: (productId) => op("variant", "list", { parentId: productId }),
    },
    prices: {
      get: (id) => op("price", "get", { id }),
      list: (variantId) => op("price", "list", { parentId: variantId }),
    },
    files: {
      get: (id) => op("file", "get", { id }),
      list: (variantId) => op("file", "list", { parentId: variantId }),
    },
    customers: {
      get: (id) => op("customer", "get", { id }),
      list: (storeId) => op("customer", "list", { storeId }),
      create: (body) => op("customer", "create", { body }),
      update: (id, body) => op("customer", "update", { id, body }),
    },
    orders: {
      get: (id) => op("order", "get", { id }),
      list: (storeId) => op("order", "list", { storeId }),
      refund: (id, body) => op("order", "refund", { id, body }),
      generateInvoice: (id, body) => op("order", "generate-invoice", { id, body }),
    },
    orderItems: {
      get: (id) => op("order-item", "get", { id }),
      list: (orderId) => op("order-item", "list", { parentId: orderId }),
    },
    subscriptions: {
      get: (id) => op("subscription", "get", { id }),
      list: (storeId) => op("subscription", "list", { storeId }),
      update: (id, body) => op("subscription", "update", { id, body }),
      cancel: (id) => op("subscription", "cancel", { id }),
    },
    subscriptionItems: {
      get: (id) => op("subscription-item", "get", { id }),
      list: (subscriptionId) => op("subscription-item", "list", { parentId: subscriptionId }),
      update: (id, body) => op("subscription-item", "update", { id, body }),
      currentUsage: (id) => op("subscription-item", "current-usage", { id }),
    },
    subscriptionInvoices: {
      get: (id) => op("subscription-invoice", "get", { id }),
      list: (subscriptionId) => op("subscription-invoice", "list", { parentId: subscriptionId }),
      refund: (id, body) => op("subscription-invoice", "refund", { id, body }),
      generateInvoice: (id, body) => op("subscription-invoice", "generate-invoice", { id, body }),
    },
    usageRecords: {
      get: (id) => op("usage-record", "get", { id }),
      list: (subscriptionItemId) => op("usage-record", "list", { parentId: subscriptionItemId }),
      create: (body) => op("usage-record", "create", { body }),
    },
    discounts: {
      get: (id) => op("discount", "get", { id }),
      list: (storeId) => op("discount", "list", { storeId }),
      create: (body) => op("discount", "create", { body }),
      delete: (id) => op("discount", "delete", { id }),
    },
    discountRedemptions: {
      get: (id) => op("discount-redemption", "get", { id }),
      list: (discountId) => op("discount-redemption", "list", { parentId: discountId }),
    },
    licenseKeys: {
      get: (id) => op("license-key", "get", { id }),
      list: (storeId) => op("license-key", "list", { storeId }),
      update: (id, body) => op("license-key", "update", { id, body }),
    },
    licenseKeyInstances: {
      get: (id) => op("license-key-instance", "get", { id }),
      list: (licenseKeyId) => op("license-key-instance", "list", { parentId: licenseKeyId }),
    },
    checkouts: {
      get: (id) => op("checkout", "get", { id }),
      list: (storeId) => op("checkout", "list", { storeId }),
      create: (body) => op("checkout", "create", { body }),
    },
    webhooks: {
      get: (id) => op("webhook", "get", { id }),
      list: (storeId) => op("webhook", "list", { storeId }),
      create: (body) => op("webhook", "create", { body }),
      update: (id, body) => op("webhook", "update", { id, body }),
      delete: (id) => op("webhook", "delete", { id }),
    },
    affiliates: {
      get: (id) => op("affiliate", "get", { id }),
      list: (storeId) => op("affiliate", "list", { storeId }),
    },
  };
};
