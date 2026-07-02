import { resolveConfig } from "./core/config.js";
import { HttpClient, type RequestOptions } from "./core/http.js";
import type { DoctorReport, FreshSqueezyConfig, Mode, ValidationResult } from "./core/types.js";
import type { DiscountAttributes } from "./resources/discounts.js";
import type { LicenseKeyAttributes } from "./resources/licenseKeys.js";
import type { ProductAttributes } from "./resources/products.js";
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
 * The public client. All consumer code flows through the factory below —
 * direct instantiation is intentionally not exposed so we can evolve the
 * internals without breaking callers.
 */
export interface FreshSqueezyClient {
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
  doctor(options?: DoctorOptions): Promise<DoctorReport>;
}

/**
 * Create a fresh-squeezy client. Zero-config usage reads
 * `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, and `LEMON_SQUEEZY_MODE`
 * from `process.env`.
 *
 * @example
 * ```ts
 * const lemon = createFreshSqueezy();
 * const report = await lemon.doctor();
 * if (!report.ok) process.exit(1);
 * ```
 */
export function createFreshSqueezy(config: FreshSqueezyConfig = {}): FreshSqueezyClient {
  const resolved = resolveConfig(config);
  const http = new HttpClient(resolved);

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
        storeId: options?.storeId ?? resolved.storeId,
        productId: options?.productId,
        productIds: options?.productIds,
        webhookUrl: options?.webhookUrl,
        webhookUrls: options?.webhookUrls,
        discountId: options?.discountId,
        discountIds: options?.discountIds,
        licenseKeyId: options?.licenseKeyId,
        licenseKeyIds: options?.licenseKeyIds,
        variantId: options?.variantId,
        variantIds: options?.variantIds,
      }),
  };
}
