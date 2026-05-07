import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import type { DoctorReport, Mode, ValidationResult } from "../core/types.js";
import { validateConnection, type ConnectionSummary } from "./connection.js";
import { validateStore } from "./store.js";
import { validateProduct, type ProductValidationOptions } from "./product.js";
import { validateWebhook, type WebhookValidationOptions } from "./webhook.js";
import { validateDiscount, type DiscountValidationOptions } from "./discount.js";
import { validateLicenseKey, type LicenseKeyValidationOptions } from "./licenseKey.js";
import {
  validateSubscriptionPlan,
  type SubscriptionPlanValidationOptions,
} from "./subscriptionPlan.js";
import type { StoreAttributes } from "../resources/stores.js";
import type { ProductAttributes } from "../resources/products.js";
import type { WebhookAttributes } from "../resources/webhooks.js";
import type { DiscountAttributes } from "../resources/discounts.js";
import type { LicenseKeyAttributes } from "../resources/licenseKeys.js";

/**
 * Optional targets for the doctor run. If a target is omitted, its validator
 * is skipped — consumers only pay for what they configure.
 */
export interface DoctorOptions {
  storeId?: string | number;
  productId?: string | number;
  webhookUrl?: string;
  discountId?: string | number;
  licenseKeyId?: string | number;
  variantId?: string | number;
}

/**
 * The set of validator functions doctor composes.
 *
 * Exposed as an injectable seam so tests can exercise composition order,
 * short-circuiting on connection failure, and option propagation without
 * setting up an HTTP route table for every validator. Production callers
 * normally rely on `DEFAULT_VALIDATORS`, which wires in the real
 * implementations from each `validate/*` module.
 */
export interface DoctorValidators {
  connection: (http: HttpClient, mode: Mode) => Promise<ValidationResult<ConnectionSummary>>;
  store: (
    http: HttpClient,
    mode: Mode,
    storeId: string | number
  ) => Promise<ValidationResult<StoreAttributes>>;
  product: (
    http: HttpClient,
    mode: Mode,
    options: ProductValidationOptions
  ) => Promise<ValidationResult<ProductAttributes>>;
  webhook: (
    http: HttpClient,
    mode: Mode,
    options: WebhookValidationOptions
  ) => Promise<ValidationResult<WebhookAttributes>>;
  discount: (
    http: HttpClient,
    mode: Mode,
    options: DiscountValidationOptions
  ) => Promise<ValidationResult<DiscountAttributes>>;
  licenseKey: (
    http: HttpClient,
    mode: Mode,
    options: LicenseKeyValidationOptions
  ) => Promise<ValidationResult<LicenseKeyAttributes>>;
  subscriptionPlan: (
    http: HttpClient,
    mode: Mode,
    options: SubscriptionPlanValidationOptions
  ) => Promise<ValidationResult>;
}

/** Default wiring used by `doctor` when no overrides are provided. */
export const DEFAULT_VALIDATORS: DoctorValidators = {
  connection: validateConnection,
  store: validateStore,
  product: validateProduct,
  webhook: validateWebhook,
  discount: validateDiscount,
  licenseKey: validateLicenseKey,
  subscriptionPlan: validateSubscriptionPlan,
};

/**
 * Compose every configured validator into a single report. This is the
 * primary entry point for CI health checks: one call, one structured result,
 * one exit code decision.
 *
 * Order is meaningful. Connection runs first because downstream validators
 * have nothing useful to say if the API key is broken.
 *
 * The optional `validators` parameter lets tests inject fakes without a fetch
 * mock; production callers omit it and get `DEFAULT_VALIDATORS`.
 */
export async function doctor(
  http: HttpClient,
  mode: Mode,
  options: DoctorOptions = {},
  validators: DoctorValidators = DEFAULT_VALIDATORS
): Promise<DoctorReport> {
  assertOptionsCoherent(options);

  const results: ValidationResult[] = [];

  const connection = await validators.connection(http, mode);
  results.push(connection);

  if (!connection.ok) {
    return { ok: false, mode, results };
  }

  if (options.storeId !== undefined) {
    results.push(await validators.store(http, mode, options.storeId));
  }

  if (options.productId !== undefined) {
    results.push(
      await validators.product(http, mode, {
        productId: options.productId,
        expectedStoreId: options.storeId,
      })
    );
  }

  if (options.storeId !== undefined && options.webhookUrl !== undefined) {
    results.push(
      await validators.webhook(http, mode, {
        storeId: options.storeId,
        url: options.webhookUrl,
      })
    );
  }

  if (options.storeId !== undefined && options.discountId !== undefined) {
    results.push(
      await validators.discount(http, mode, {
        storeId: options.storeId,
        discountId: options.discountId,
      })
    );
  }

  if (options.storeId !== undefined && options.licenseKeyId !== undefined) {
    results.push(
      await validators.licenseKey(http, mode, {
        storeId: options.storeId,
        licenseKeyId: options.licenseKeyId,
      })
    );
  }

  if (options.storeId !== undefined && options.variantId !== undefined) {
    results.push(
      await validators.subscriptionPlan(http, mode, {
        storeId: options.storeId,
        variantId: options.variantId,
      })
    );
  }

  const ok = results.every((result) => result.ok);
  return { ok, mode, results };
}

/**
 * Validators downstream of `storeId` (webhook, discount, licenseKey,
 * subscriptionPlan) cannot run without one. Previously, passing e.g.
 * `discountId` without `storeId` silently skipped the discount validator —
 * the doctor report came back "ok" and the consumer assumed coverage that
 * never ran.
 *
 * Treat this as a programmer error and fail fast at the boundary so the
 * miscall is surfaced at construction time rather than masked as a passing
 * doctor run.
 */
function assertOptionsCoherent(options: DoctorOptions): void {
  if (options.storeId !== undefined) return;

  const dependent: Array<keyof DoctorOptions> = [];
  if (options.webhookUrl !== undefined) dependent.push("webhookUrl");
  if (options.discountId !== undefined) dependent.push("discountId");
  if (options.licenseKeyId !== undefined) dependent.push("licenseKeyId");
  if (options.variantId !== undefined) dependent.push("variantId");

  if (dependent.length === 0) return;

  throw new FreshSqueezyError({
    code: "DOCTOR_OPTIONS_INVALID",
    message: `doctor() received ${dependent.join(", ")} without storeId. These validators cannot run without a store; pass \`storeId\` or remove the dependent options.`,
  });
}
