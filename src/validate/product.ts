import type { HttpClient } from "@/core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "@/core/types.js";
import type { ProductAttributes, VariantAttributes } from "@/resources/attributes.js";
import { ISSUE_CODES, buildResult, issue } from "./issues.js";
import { checkStoreOwnership, probeCollection, probeFetch } from "./probe.js";

export interface ProductValidationOptions {
  productId: string | number;
  expectedStoreId?: string | number;
}

export const validateProduct = async (
  http: HttpClient,
  mode: Mode,
  options: ProductValidationOptions,
): Promise<ValidationResult<ProductAttributes>> => {
  const issues: ValidationIssue[] = [];
  const target = {
    label: `product ${options.productId}`,
    id: String(options.productId),
  };

  const fetched = await probeFetch(
    () => http.getResource<ProductAttributes>(`/v1/products/${options.productId}`),
    {
      notFoundCode: ISSUE_CODES.PRODUCT_NOT_FOUND,
      notFoundMessage: `Product ${options.productId} not found.`,
      notFoundFix: "Verify the product ID in the Lemon Squeezy dashboard.",
      notFoundContext: { productId: String(options.productId) },
    },
  );

  if (!fetched.ok) {
    return buildResult<ProductAttributes>("product", mode, [fetched.issue], undefined, target);
  }

  const attrs = fetched.resource.attributes;
  issues.push(...checkProduct(attrs, { expectedStoreId: options.expectedStoreId }));

  // Variant population needs a second fetch, so it stays out of the pure check.
  // Listing is best-effort: map via probeCollection, then soft-fail as warning.
  const variantsProbed = await probeCollection(() =>
    http.paginate<VariantAttributes>("/v1/variants", {
      "filter[product_id]": String(options.productId),
    }),
  );
  if (!variantsProbed.ok) {
    issues.push({ ...variantsProbed.issue, severity: "warning" });
  } else if (variantsProbed.resource.length === 0) {
    issues.push(
      issue(
        ISSUE_CODES.VARIANT_MISSING,
        "error",
        "Product has no variants. Customers cannot purchase it.",
        { suggestedFix: "Add at least one variant in the product configuration." },
      ),
    );
  } else if (
    !variantsProbed.resource.some((variant) => variant.attributes.status === "published")
  ) {
    issues.push(
      issue(
        ISSUE_CODES.VARIANT_UNPUBLISHED,
        "error",
        "Product has variants but none are published.",
        { suggestedFix: "Publish at least one variant." },
      ),
    );
  }

  return buildResult("product", mode, issues, attrs, {
    label: attrs.name,
    id: String(options.productId),
  });
};

export const checkProduct = (
  attrs: ProductAttributes,
  options: { expectedStoreId?: string | number } = {},
): ValidationIssue[] => {
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
};
