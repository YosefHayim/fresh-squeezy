import type {
	ProductAttributes,
	VariantAttributes,
} from "@/shared/attributes.js";
import type {
	Mode,
	ResourceId,
	ValidationIssue,
	ValidationResult,
} from "@/shared/contracts.js";
import type { HttpClient } from "@/shared/http.js";
import {
	buildResult,
	failedResult,
	ISSUE_CODES,
	type IssueRule,
	issuesOf,
} from "./issues.js";
import {
	checkStoreOwnership,
	type FetchProbeOutcome,
	probeCollection,
	probeFetch,
} from "./probe.js";

export interface ProductValidationOptions {
	productId: ResourceId;
	expectedStoreId?: ResourceId;
}

type Variants = { attributes: VariantAttributes }[];

const variantIssueRules: IssueRule<Variants>[] = [
	{
		code: ISSUE_CODES.VARIANT_MISSING,
		severity: "error",
		isRaised: (variants) => variants.length === 0,
		message: "Product has no variants. Customers cannot purchase it.",
		suggestedFix: "Add at least one variant in the product configuration.",
	},
	{
		code: ISSUE_CODES.VARIANT_UNPUBLISHED,
		severity: "error",
		isRaised: (variants) =>
			variants.length > 0 &&
			!variants.some((variant) => variant.attributes.status === "published"),
		message: "Product has variants but none are published.",
		suggestedFix: "Publish at least one variant.",
	},
];

const productIssueRules: IssueRule<ProductAttributes>[] = [
	{
		code: ISSUE_CODES.PRODUCT_UNPUBLISHED,
		severity: "error",
		isRaised: (attributes) => attributes.status !== "published",
		message: (attributes) =>
			`Product is in "${attributes.status}" state, not "published".`,
		suggestedFix:
			"Publish the product in the Lemon Squeezy dashboard before selling.",
		context: (attributes) => ({ status: attributes.status }),
	},
	{
		code: ISSUE_CODES.PRODUCT_NO_BUY_URL,
		severity: "warning",
		isRaised: (attributes) => !attributes.buy_now_url,
		message: "Product has no buy-now URL. Hosted checkout may be disabled.",
		suggestedFix:
			"Enable buy-now in product settings, or use a custom checkout flow.",
	},
];

const checkVariants = (
	variantsProbed: FetchProbeOutcome<Variants>,
): ValidationIssue[] => {
	const isVariantListFailed = !variantsProbed.ok;
	if (isVariantListFailed) {
		return [{ ...variantsProbed.issue, severity: "warning" }];
	}
	return issuesOf(variantIssueRules, variantsProbed.resource);
};

export const validateProduct = async (
	http: HttpClient,
	mode: Mode,
	options: ProductValidationOptions,
): Promise<ValidationResult<ProductAttributes>> => {
	const target = {
		label: `product ${options.productId}`,
		id: String(options.productId),
	};

	const fetched = await probeFetch(
		() =>
			http.getResource<ProductAttributes>(`/v1/products/${options.productId}`),
		{
			code: ISSUE_CODES.PRODUCT_NOT_FOUND,
			message: `Product ${options.productId} not found.`,
			suggestedFix: "Verify the product ID in the Lemon Squeezy dashboard.",
			context: { productId: String(options.productId) },
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return failedResult("product", mode, fetched.issue, target);
	}

	const attributes = fetched.resource.attributes;
	const productIssues = checkProduct(attributes, {
		expectedStoreId: options.expectedStoreId,
	});

	// Variant population needs a second fetch, so it stays out of the pure check.
	// Listing is best-effort: map via probeCollection, then soft-fail as warning.
	const variantsProbed = await probeCollection(() =>
		http.paginate<VariantAttributes>("/v1/variants", {
			"filter[product_id]": String(options.productId),
		}),
	);
	const variantIssues = checkVariants(variantsProbed);

	return buildResult(
		"product",
		mode,
		[...productIssues, ...variantIssues],
		attributes,
		{ label: attributes.name, id: String(options.productId) },
	);
};

export const checkProduct = (
	attributes: ProductAttributes,
	options: { expectedStoreId?: ResourceId } = {},
): ValidationIssue[] => {
	const { expectedStoreId } = options;
	const isStoreExpected = expectedStoreId !== undefined;
	const ownershipIssues = isStoreExpected
		? checkStoreOwnership({
				expectedStoreId,
				actualStoreId: attributes.store_id,
				code: ISSUE_CODES.PRODUCT_WRONG_STORE,
				label: "Product",
				suggestedFix:
					"Either use the correct store ID or the correct product ID — IDs should not cross stores.",
			})
		: [];
	return [...ownershipIssues, ...issuesOf(productIssueRules, attributes)];
};
