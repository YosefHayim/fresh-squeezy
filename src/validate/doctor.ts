import type { HttpClient } from "../core/http.js";
import type { DoctorReport, Mode, ValidationResult } from "../core/types.js";
import { validateConnection } from "./connection.js";
import { validateStore } from "./store.js";
import { validateProduct } from "./product.js";
import { validateWebhook } from "./webhook.js";
import { validateDiscount } from "./discount.js";
import { validateLicenseKey } from "./licenseKey.js";
import { validateSubscriptionPlan } from "./subscriptionPlan.js";

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
 * Compose every configured validator into a single report. This is the
 * primary entry point for CI health checks: one call, one structured result,
 * one exit code decision.
 *
 * Order is meaningful. Connection runs first because downstream validators
 * have nothing useful to say if the API key is broken.
 */
export async function doctor(
  http: HttpClient,
  mode: Mode,
  options: DoctorOptions = {}
): Promise<DoctorReport> {
  const results: ValidationResult[] = [];

  const connection = await validateConnection(http, mode);
  results.push(connection);

  if (!connection.ok) {
    return { ok: false, mode, results };
  }

  if (options.storeId !== undefined) {
    results.push(await validateStore(http, mode, options.storeId));
  }

  if (options.productId !== undefined) {
    results.push(
      await validateProduct(http, mode, {
        productId: options.productId,
        expectedStoreId: options.storeId,
      })
    );
  }

  if (options.storeId !== undefined && options.webhookUrl !== undefined) {
    results.push(
      await validateWebhook(http, mode, {
        storeId: options.storeId,
        url: options.webhookUrl,
      })
    );
  }

  if (options.storeId !== undefined && options.discountId !== undefined) {
    results.push(
      await validateDiscount(http, mode, {
        storeId: options.storeId,
        discountId: options.discountId,
      })
    );
  }

  if (options.storeId !== undefined && options.licenseKeyId !== undefined) {
    results.push(
      await validateLicenseKey(http, mode, {
        storeId: options.storeId,
        licenseKeyId: options.licenseKeyId,
      })
    );
  }

  if (options.storeId !== undefined && options.variantId !== undefined) {
    results.push(
      await validateSubscriptionPlan(http, mode, {
        storeId: options.storeId,
        variantId: options.variantId,
      })
    );
  }

  const ok = results.every((result) => result.ok);
  return { ok, mode, results };
}
