import type { Mode } from "@/client/environment.js";
import type { Http } from "@/client/http.js";
import type {
	ProductAttributes,
	VariantAttributes,
} from "@/client/lemon-squeezy-types.js";
import {
	fetchCollection,
	fetchResource,
	storeMismatchFindings,
} from "./fetch-resource.js";
import {
	type CheckReport,
	createCheckReport,
	FINDING_CODES,
	type Finding,
	type FindingRule,
	raiseFindings,
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

const checkVariants = async (
	http: Http,
	productId: string,
): Promise<Finding[]> => {
	const variantsLookup = await fetchCollection<VariantAttributes>(http, {
		path: "/v1/variants",
		query: { "filter[product_id]": productId },
	});
	// Listing variants is best-effort, so a failed list is only a warning.
	const isListFailed = variantsLookup.kind === "failed";
	if (isListFailed) return [{ ...variantsLookup.finding, severity: "warning" }];
	return raiseFindings(VARIANT_RULES, variantsLookup.resource);
};

const checkStoreOwnership = (
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
): Promise<CheckReport<ProductAttributes>> => {
	const productLookup = await fetchResource<ProductAttributes>(http, {
		path: `/v1/products/${productId}`,
		notFound: {
			code: FINDING_CODES.PRODUCT_NOT_FOUND,
			message: `Product ${productId} not found.`,
			suggestedFix: "Verify the product ID in the Lemon Squeezy dashboard.",
			context: { productId },
		},
	});

	const isFetchFailed = productLookup.kind === "failed";
	if (isFetchFailed) {
		return createCheckReport({
			name: "product",
			mode,
			findings: [productLookup.finding],
			target: { label: `product ${productId}`, id: productId },
		});
	}

	const product = productLookup.resource;
	const storeFindings = checkStoreOwnership(product, expectedStoreId);
	const productFindings = raiseFindings(PRODUCT_RULES, product);
	const variantFindings = await checkVariants(http, productId);
	return createCheckReport({
		name: "product",
		mode,
		findings: [...storeFindings, ...productFindings, ...variantFindings],
		resource: product,
		target: { label: product.name, id: productId },
	});
};
