import type { Mode } from "@/shared/config.js";
import type { Http } from "@/shared/http.js";
import type {
	ProductAttributes,
	VariantAttributes,
} from "@/shared/lemon-squeezy-types.js";
import {
	fetchCollection,
	fetchResource,
	storeMismatchFindings,
} from "./fetch-resource.js";
import {
	buildResult,
	FINDING_CODES,
	type Finding,
	type FindingRule,
	findingsFrom,
	type ValidationResult,
} from "./findings.js";

export interface ProductCheck {
	productId: string;
	expectedStoreId?: string;
}

type Variants = { attributes: VariantAttributes }[];

const hasNoVariants = (variants: Variants) => variants.length === 0;

const isPublished = (variant: Variants[number]) =>
	variant.attributes.status === "published";

// A pending variant with no siblings is the default variant, sold at checkout: https://docs.lemonsqueezy.com/api/variants/the-variant-object
const isDefaultVariantOnly = (variants: Variants) => {
	const isOneVariant = variants.length === 1;
	const isPending = variants[0]?.attributes.status === "pending";
	return isOneVariant && isPending;
};

const hasNoSellableVariant = (variants: Variants) => {
	const hasVariants = variants.length > 0;
	const isAnyPublished = variants.some(isPublished);
	const isSellable = isAnyPublished || isDefaultVariantOnly(variants);
	return hasVariants && !isSellable;
};

const isNotPublished = (product: ProductAttributes) =>
	product.status !== "published";

const hasNoBuyUrl = (product: ProductAttributes) => !product.buy_now_url;

const VARIANT_RULES: FindingRule<Variants>[] = [
	{
		code: FINDING_CODES.VARIANT_MISSING,
		severity: "error",
		when: hasNoVariants,
		message: "Product has no variants. Customers cannot purchase it.",
		suggestedFix: "Add at least one variant in the product configuration.",
	},
	{
		code: FINDING_CODES.VARIANT_UNPUBLISHED,
		severity: "error",
		when: hasNoSellableVariant,
		message: "Product has variants but none are published.",
		suggestedFix: "Publish at least one variant.",
	},
];

const PRODUCT_RULES: FindingRule<ProductAttributes>[] = [
	{
		code: FINDING_CODES.PRODUCT_UNPUBLISHED,
		severity: "error",
		when: isNotPublished,
		message: (product) =>
			`Product is in "${product.status}" state, not "published".`,
		suggestedFix:
			"Publish the product in the Lemon Squeezy dashboard before selling.",
		context: (product) => ({ status: product.status }),
	},
	{
		code: FINDING_CODES.PRODUCT_NO_BUY_URL,
		severity: "warning",
		when: hasNoBuyUrl,
		message: "Product has no buy-now URL. Hosted checkout may be disabled.",
		suggestedFix:
			"Enable buy-now in product settings, or use a custom checkout flow.",
	},
];

const variantFindingsOf = async (
	http: Http,
	productId: string,
): Promise<Finding[]> => {
	const fetched = await fetchCollection<VariantAttributes>(http, {
		path: "/v1/variants",
		query: { "filter[product_id]": productId },
	});
	// Listing variants is best-effort, so a failed list is only a warning.
	const isListFailed = fetched.kind === "failed";
	if (isListFailed) return [{ ...fetched.finding, severity: "warning" }];
	return findingsFrom(VARIANT_RULES, fetched.payload);
};

const storeFindingsOf = (
	product: ProductAttributes,
	expectedStoreId?: string,
) => {
	const isStoreExpected = expectedStoreId !== undefined;
	const isStoreUnknown = !isStoreExpected;
	if (isStoreUnknown) return [];
	return storeMismatchFindings({
		label: "Product",
		code: FINDING_CODES.PRODUCT_WRONG_STORE,
		expectedStoreId,
		actualStoreId: product.store_id,
		suggestedFix:
			"Either use the correct store ID or the correct product ID — IDs should not cross stores.",
	});
};

export const validateProduct = async (
	http: Http,
	mode: Mode,
	{ productId, expectedStoreId }: ProductCheck,
): Promise<ValidationResult<ProductAttributes>> => {
	const fetched = await fetchResource<ProductAttributes>(http, {
		path: `/v1/products/${productId}`,
		notFound: {
			code: FINDING_CODES.PRODUCT_NOT_FOUND,
			message: `Product ${productId} not found.`,
			suggestedFix: "Verify the product ID in the Lemon Squeezy dashboard.",
			context: { productId },
		},
	});

	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) {
		return buildResult({
			name: "product",
			mode,
			findings: [fetched.finding],
			target: { label: `product ${productId}`, id: productId },
		});
	}

	const product = fetched.payload;
	const storeFindings = storeFindingsOf(product, expectedStoreId);
	const productFindings = findingsFrom(PRODUCT_RULES, product);
	const variantFindings = await variantFindingsOf(http, productId);
	return buildResult({
		name: "product",
		mode,
		findings: [...storeFindings, ...productFindings, ...variantFindings],
		resource: product,
		target: { label: product.name, id: productId },
	});
};
