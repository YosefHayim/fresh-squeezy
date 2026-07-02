import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { type ProductAttributes, getProduct } from "../resources/products.js";
import { listVariantsForProduct } from "../resources/variants.js";
import { checkStoreOwnership, probeFetch } from "./probe.js";
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
  options: ProductValidationOptions,
): Promise<ValidationResult<ProductAttributes>> {
  const issues: ValidationIssue[] = [];

  const fetched = await probeFetch(() => getProduct(http, options.productId), {
    notFoundCode: ISSUE_CODES.PRODUCT_NOT_FOUND,
    notFoundMessage: `Product ${options.productId} not found.`,
    notFoundFix: "Verify the product ID in the Lemon Squeezy dashboard.",
    notFoundContext: { productId: String(options.productId) },
  });

  if (!fetched.ok) {
    issues.push(fetched.issue);
    return buildResult<ProductAttributes>("product", mode, issues, undefined, {
      label: `product ${options.productId}`,
      id: String(options.productId),
    });
  }

  const attrs = fetched.resource.attributes;
  issues.push(...checkProduct(attrs, { expectedStoreId: options.expectedStoreId }));

  // Variant population needs a second fetch, so it stays out of the pure check.
  try {
    const variants = await listVariantsForProduct(http, options.productId);
    if (variants.length === 0) {
      issues.push(
        issue(
          ISSUE_CODES.VARIANT_MISSING,
          "error",
          "Product has no variants. Customers cannot purchase it.",
          { suggestedFix: "Add at least one variant in the product configuration." },
        ),
      );
    } else if (!variants.some((variant) => variant.attributes.status === "published")) {
      issues.push(
        issue(
          ISSUE_CODES.VARIANT_UNPUBLISHED,
          "error",
          "Product has variants but none are published.",
          { suggestedFix: "Publish at least one variant." },
        ),
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching variants";
    issues.push(issue(ISSUE_CODES.UNKNOWN, "warning", message));
  }

  return buildResult("product", mode, issues, attrs, {
    label: attrs.name,
    id: String(options.productId),
  });
}

/**
 * Pure attribute assertions for a product: store ownership, publish state, and
 * hosted-checkout availability. The variant-population rule needs a second
 * fetch and stays in `validateProduct`; everything here runs on plain data, so
 * the rules are unit-testable without a mock fetch.
 */
export function checkProduct(
  attrs: ProductAttributes,
  options: { expectedStoreId?: string | number } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (options.expectedStoreId !== undefined) {
    const mismatch = checkStoreOwnership({
      expectedStoreId: options.expectedStoreId,
      actualStoreId: attrs.store_id,
      code: ISSUE_CODES.PRODUCT_WRONG_STORE,
      label: "Product",
      suggestedFix:
        "Either use the correct store ID or the correct product ID — IDs should not cross stores.",
    });
    if (mismatch) issues.push(mismatch);
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
        },
      ),
    );
  }

  if (!attrs.buy_now_url) {
    issues.push(
      issue(
        ISSUE_CODES.PRODUCT_NO_BUY_URL,
        "warning",
        "Product has no buy-now URL. Hosted checkout may be disabled.",
        { suggestedFix: "Enable buy-now in product settings, or use a custom checkout flow." },
      ),
    );
  }

  return issues;
}
