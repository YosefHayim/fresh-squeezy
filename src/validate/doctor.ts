import type {
	DoctorReport,
	Mode,
	ValidationResult,
} from "@/contracts/contracts.js";
import { freshSqueezyErrorOf } from "@/errors/errors.js";
import type { HttpClient } from "@/http/http.js";
import type {
	DiscountAttributes,
	LicenseKeyAttributes,
	ProductAttributes,
	StoreAttributes,
	WebhookAttributes,
} from "@/resources/attributes.js";
import { type ConnectionSummary, validateConnection } from "./connection.js";
import {
	type DiscountValidationOptions,
	validateDiscount,
} from "./discount.js";
import {
	type LicenseKeyValidationOptions,
	validateLicenseKey,
} from "./license-key.js";
import { type ProductValidationOptions, validateProduct } from "./product.js";
import { validateStore } from "./store.js";
import {
	type SubscriptionPlanValidationOptions,
	validateSubscriptionPlan,
} from "./subscription-plan.js";
import { validateWebhook, type WebhookValidationOptions } from "./webhook.js";

export interface DoctorOptions {
	storeId?: string | number;
	productId?: string | number;
	productIds?: Array<string | number>;
	webhookUrl?: string;
	webhookUrls?: string[];
	discountId?: string | number;
	discountIds?: Array<string | number>;
	licenseKeyId?: string | number;
	licenseKeyIds?: Array<string | number>;
	variantId?: string | number;
	variantIds?: Array<string | number>;
}

export interface DoctorValidators {
	connection: (
		http: HttpClient,
		mode: Mode,
	) => Promise<ValidationResult<ConnectionSummary>>;
	store: (
		http: HttpClient,
		mode: Mode,
		storeId: string | number,
	) => Promise<ValidationResult<StoreAttributes>>;
	product: (
		http: HttpClient,
		mode: Mode,
		options: ProductValidationOptions,
	) => Promise<ValidationResult<ProductAttributes>>;
	webhook: (
		http: HttpClient,
		mode: Mode,
		options: WebhookValidationOptions,
	) => Promise<ValidationResult<WebhookAttributes>>;
	discount: (
		http: HttpClient,
		mode: Mode,
		options: DiscountValidationOptions,
	) => Promise<ValidationResult<DiscountAttributes>>;
	licenseKey: (
		http: HttpClient,
		mode: Mode,
		options: LicenseKeyValidationOptions,
	) => Promise<ValidationResult<LicenseKeyAttributes>>;
	subscriptionPlan: (
		http: HttpClient,
		mode: Mode,
		options: SubscriptionPlanValidationOptions,
	) => Promise<ValidationResult>;
}

export const DEFAULT_VALIDATORS: DoctorValidators = {
	connection: validateConnection,
	store: validateStore,
	product: validateProduct,
	webhook: validateWebhook,
	discount: validateDiscount,
	licenseKey: validateLicenseKey,
	subscriptionPlan: validateSubscriptionPlan,
};

export const doctor = async (
	http: HttpClient,
	mode: Mode,
	options: DoctorOptions = {},
	validators: DoctorValidators = DEFAULT_VALIDATORS,
): Promise<DoctorReport> => {
	assertOptionsCoherent(options);

	const results: ValidationResult[] = [];
	const productIds = collectValues(options.productId, options.productIds);
	const webhookUrls = collectValues(options.webhookUrl, options.webhookUrls);
	const discountIds = collectValues(options.discountId, options.discountIds);
	const licenseKeyIds = collectValues(
		options.licenseKeyId,
		options.licenseKeyIds,
	);
	const variantIds = collectValues(options.variantId, options.variantIds);

	const connection = await validators.connection(http, mode);
	results.push(connection);

	const isConnectionFailed = !connection.ok;
	if (isConnectionFailed) {
		return { ok: false, mode, results };
	}

	const { storeId } = options;
	const isStoreGiven = storeId !== undefined;
	if (isStoreGiven) {
		const storeResult = await validators.store(http, mode, storeId);
		results.push(storeResult);
	}

	for (const productId of productIds) {
		const productResult = await validators.product(http, mode, {
			productId,
			expectedStoreId: storeId,
		});
		results.push(productResult);
	}

	// webhook / discount / licenseKey / subscriptionPlan all require storeId
	// (assertOptionsCoherent rejects those options when storeId is absent).
	if (isStoreGiven) {
		for (const url of webhookUrls) {
			const webhookResult = await validators.webhook(http, mode, {
				storeId,
				url,
			});
			results.push(webhookResult);
		}
		for (const discountId of discountIds) {
			const discountResult = await validators.discount(http, mode, {
				storeId,
				discountId,
			});
			results.push(discountResult);
		}
		for (const licenseKeyId of licenseKeyIds) {
			const licenseKeyResult = await validators.licenseKey(http, mode, {
				storeId,
				licenseKeyId,
			});
			results.push(licenseKeyResult);
		}
		for (const variantId of variantIds) {
			const planResult = await validators.subscriptionPlan(http, mode, {
				storeId,
				variantId,
			});
			results.push(planResult);
		}
	}

	const isEveryResultOk = results.every((entry) => entry.ok);
	return { ok: isEveryResultOk, mode, results };
};

const assertOptionsCoherent = (options: DoctorOptions): void => {
	const isStoreGiven = options.storeId !== undefined;
	if (isStoreGiven) return;

	const isWebhookGiven = hasAny(options.webhookUrl, options.webhookUrls);
	const isDiscountGiven = hasAny(options.discountId, options.discountIds);
	const isLicenseKeyGiven = hasAny(options.licenseKeyId, options.licenseKeyIds);
	const isVariantGiven = hasAny(options.variantId, options.variantIds);

	const dependent: Array<keyof DoctorOptions> = [];
	if (isWebhookGiven) dependent.push("webhookUrl");
	if (isDiscountGiven) dependent.push("discountId");
	if (isLicenseKeyGiven) dependent.push("licenseKeyId");
	if (isVariantGiven) dependent.push("variantId");

	const isEverythingCoherent = dependent.length === 0;
	if (isEverythingCoherent) return;

	throw freshSqueezyErrorOf({
		code: "DOCTOR_OPTIONS_INVALID",
		message: `doctor() received ${dependent.join(", ")} without storeId. These validators cannot run without a store; pass \`storeId\` or remove the dependent options.`,
	});
};

const collectValues = <T>(
	single: T | undefined,
	many: T[] | undefined,
): T[] => {
	const values = new Set<T>();
	const isSingleGiven = single !== undefined;
	if (isSingleGiven) values.add(single);
	for (const value of many ?? []) {
		const isValueGiven = value !== undefined;
		if (isValueGiven) values.add(value);
	}
	return Array.from(values);
};

const hasAny = <T>(single: T | undefined, many: T[] | undefined): boolean => {
	const manyCount = many?.length ?? 0;
	return single !== undefined || manyCount > 0;
};
