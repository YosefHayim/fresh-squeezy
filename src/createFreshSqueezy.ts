import { resolveConfig } from "./core/config.js";
import { HttpClient, type RequestOptions } from "./core/http.js";
import type { FreshSqueezyConfig, DoctorReport, Mode, ValidationResult } from "./core/types.js";
import { validateConnection, type ConnectionSummary } from "./validate/connection.js";
import { validateStore } from "./validate/store.js";
import { validateProduct, type ProductValidationOptions } from "./validate/product.js";
import { validateWebhook, type WebhookValidationOptions } from "./validate/webhook.js";
import { validateDiscount, type DiscountValidationOptions } from "./validate/discount.js";
import { validateLicenseKey, type LicenseKeyValidationOptions } from "./validate/licenseKey.js";
import { validateSubscriptionPlan, type SubscriptionPlanValidationOptions, type SubscriptionPlanSummary } from "./validate/subscriptionPlan.js";
import { doctor, type DoctorOptions } from "./validate/doctor.js";
import type { StoreAttributes } from "./resources/stores.js";
import type { ProductAttributes } from "./resources/products.js";
import type { WebhookAttributes } from "./resources/webhooks.js";
import type { DiscountAttributes } from "./resources/discounts.js";
import type { LicenseKeyAttributes } from "./resources/licenseKeys.js";

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
  validateDiscount(options: DiscountValidationOptions): Promise<ValidationResult<DiscountAttributes>>;
  validateLicenseKey(options: LicenseKeyValidationOptions): Promise<ValidationResult<LicenseKeyAttributes>>;
  validateSubscriptionPlan(options: SubscriptionPlanValidationOptions): Promise<ValidationResult<SubscriptionPlanSummary>>;
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
        webhookUrl: options?.webhookUrl,
        discountId: options?.discountId,
        licenseKeyId: options?.licenseKeyId,
        variantId: options?.variantId,
      }),
  };
}
