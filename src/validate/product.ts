import type { HttpClient } from "@/http/http.js";
import type {
	Mode,
	ValidationIssue,
	ValidationResult,
} from "@/contracts/contracts.js";
import type {
	ProductAttributes,
	VariantAttributes,
} from "@/resources/attributes.js";
import { ISSUE_CODES, buildResult, issue } from "./issues.js";
import {
	type FetchProbeOutcome,
	checkStoreOwnership,
	probeCollection,
	probeFetch,
} from "./probe.js";

export interface ProductValidationOptions {
	productId: string | number;
	expectedStoreId?: string | number;
}

const checkVariants = (
	variantsProbed: FetchProbeOutcome<{ attributes: VariantAttributes }[]>,
): ValidationIssue[] => {
	const isVariantListFailed = !variantsProbed.ok;
	if (isVariantListFailed) {
		return [{ ...variantsProbed.issue, severity: "warning" }];
	}

	const variants = variantsProbed.resource;
	const isThereNoVariant = variants.length === 0;
	if (isThereNoVariant) {
		const noVariantIssue = issue(
			ISSUE_CODES.VARIANT_MISSING,
			"error",
			"Product has no variants. Customers cannot purchase it.",
			{
				suggestedFix: "Add at least one variant in the product configuration.",
			},
		);
		return [noVariantIssue];
	}

	const isAnyVariantPublished = variants.some(
		(variant) => variant.attributes.status === "published",
	);
	if (isAnyVariantPublished) return [];

	const unpublishedVariantIssue = issue(
		ISSUE_CODES.VARIANT_UNPUBLISHED,
		"error",
		"Product has variants but none are published.",
		{ suggestedFix: "Publish at least one variant." },
	);
	return [unpublishedVariantIssue];
};

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
		() =>
			http.getResource<ProductAttributes>(`/v1/products/${options.productId}`),
		{
			notFoundCode: ISSUE_CODES.PRODUCT_NOT_FOUND,
			notFoundMessage: `Product ${options.productId} not found.`,
			notFoundFix: "Verify the product ID in the Lemon Squeezy dashboard.",
			notFoundContext: { productId: String(options.productId) },
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return buildResult<ProductAttributes>(
			"product",
			mode,
			[fetched.issue],
			undefined,
			target,
		);
	}

	const attrs = fetched.resource.attributes;
	const productIssues = checkProduct(attrs, {
		expectedStoreId: options.expectedStoreId,
	});
	issues.push(...productIssues);

	// Variant population needs a second fetch, so it stays out of the pure check.
	// Listing is best-effort: map via probeCollection, then soft-fail as warning.
	const variantsProbed = await probeCollection(() =>
		http.paginate<VariantAttributes>("/v1/variants", {
			"filter[product_id]": String(options.productId),
		}),
	);
	const variantIssues = checkVariants(variantsProbed);
	issues.push(...variantIssues);

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

	const { expectedStoreId } = options;
	const isStoreExpected = expectedStoreId !== undefined;
	const mismatch = isStoreExpected
		? checkStoreOwnership({
				expectedStoreId,
				actualStoreId: attrs.store_id,
				code: ISSUE_CODES.PRODUCT_WRONG_STORE,
				label: "Product",
				suggestedFix:
					"Either use the correct store ID or the correct product ID — IDs should not cross stores.",
			})
		: null;
	if (mismatch) issues.push(mismatch);

	const isUnpublished = attrs.status !== "published";
	if (isUnpublished) {
		const unpublishedIssue = issue(
			ISSUE_CODES.PRODUCT_UNPUBLISHED,
			"error",
			`Product is in "${attrs.status}" state, not "published".`,
			{
				suggestedFix:
					"Publish the product in the Lemon Squeezy dashboard before selling.",
				context: { status: attrs.status },
			},
		);
		issues.push(unpublishedIssue);
	}

	const isBuyUrlMissing = !attrs.buy_now_url;
	if (isBuyUrlMissing) {
		const noBuyUrlIssue = issue(
			ISSUE_CODES.PRODUCT_NO_BUY_URL,
			"warning",
			"Product has no buy-now URL. Hosted checkout may be disabled.",
			{
				suggestedFix:
					"Enable buy-now in product settings, or use a custom checkout flow.",
			},
		);
		issues.push(noBuyUrlIssue);
	}

	return issues;
};
