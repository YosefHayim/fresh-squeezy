import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { getProduct, type ProductAttributes } from "../resources/products.js";
import { listVariantsForProduct } from "../resources/variants.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

export interface ProductValidationOptions {
  productId: string | number;
  /** Optional: confirm the product belongs to this store. */
  expectedStoreId?: string | number;
}

/**
 * Validate a product's publish state, store ownership, and that it has at
 * least one published variant. Surfaces the most common misconfigurations
 * caught in the wild (unpublished product, wrong store, missing variants).
 */
export async function validateProduct(
  http: HttpClient,
  mode: Mode,
  options: ProductValidationOptions
): Promise<ValidationResult<ProductAttributes>> {
  const issues: ValidationIssue[] = [];

  let product;
  try {
    product = await getProduct(http, options.productId);
  } catch (err) {
    if (err instanceof FreshSqueezyError && err.status === 404) {
      issues.push(
        issue(
          ISSUE_CODES.PRODUCT_NOT_FOUND,
          "error",
          `Product ${options.productId} not found.`,
          {
            suggestedFix: "Verify the product ID in the Lemon Squeezy dashboard.",
            context: { productId: String(options.productId) },
          }
        )
      );
      return buildResult("product", mode, issues);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    issues.push(issue(ISSUE_CODES.UNKNOWN, "error", message));
    return buildResult("product", mode, issues);
  }

  const attrs = product.attributes;

  if (options.expectedStoreId !== undefined) {
    const expected = String(options.expectedStoreId);
    const actual = String(attrs.store_id);
    if (expected !== actual) {
      issues.push(
        issue(
          ISSUE_CODES.PRODUCT_WRONG_STORE,
          "error",
          `Product belongs to store ${actual}, expected ${expected}.`,
          {
            suggestedFix:
              "Either use the correct store ID or the correct product ID — IDs should not cross stores.",
            context: { expectedStoreId: expected, actualStoreId: actual },
          }
        )
      );
    }
  }

  if (attrs.status !== "published") {
    issues.push(
      issue(
        ISSUE_CODES.PRODUCT_UNPUBLISHED,
        "error",
        `Product is in "${attrs.status}" state, not "published".`,
        {
          suggestedFix: "Publish the product in the Lemon Squeezy dashboard before selling.",
          context: { status: attrs.status },
        }
      )
    );
  }

  if (!attrs.buy_now_url) {
    issues.push(
      issue(
        ISSUE_CODES.PRODUCT_NO_BUY_URL,
        "warning",
        "Product has no buy-now URL. Hosted checkout may be disabled.",
        { suggestedFix: "Enable buy-now in product settings, or use a custom checkout flow." }
      )
    );
  }

  try {
    const variants = await listVariantsForProduct(http, options.productId);
    if (variants.length === 0) {
      issues.push(
        issue(
          ISSUE_CODES.VARIANT_MISSING,
          "error",
          "Product has no variants. Customers cannot purchase it.",
          { suggestedFix: "Add at least one variant in the product configuration." }
        )
      );
    } else if (!variants.some((variant) => variant.attributes.status === "published")) {
      issues.push(
        issue(
          ISSUE_CODES.VARIANT_UNPUBLISHED,
          "error",
          "Product has variants but none are published.",
          { suggestedFix: "Publish at least one variant." }
        )
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching variants";
    issues.push(issue(ISSUE_CODES.UNKNOWN, "warning", message));
  }

  return buildResult("product", mode, issues, attrs);
}
