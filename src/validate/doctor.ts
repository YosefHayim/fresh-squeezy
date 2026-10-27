import { freshSqueezyErrorOf } from "@/errors/errors.js";
import type { HttpClient } from "@/http/http.js";
import type {
	DoctorReport,
	Mode,
	ValidationResult,
} from "@/contracts/contracts.js";
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
import { type WebhookValidationOptions, validateWebhook } from "./webhook.js";

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

	if (!connection.ok) {
		return { ok: false, mode, results };
	}

	if (options.storeId !== undefined) {
		results.push(await validators.store(http, mode, options.storeId));
	}

	for (const productId of productIds) {
		results.push(
			await validators.product(http, mode, {
				productId,
				expectedStoreId: options.storeId,
			}),
		);
	}

	// webhook / discount / licenseKey / subscriptionPlan all require storeId
	// (assertOptionsCoherent rejects those options when storeId is absent).
	if (options.storeId !== undefined) {
		const storeId = options.storeId;
		for (const url of webhookUrls) {
			results.push(await validators.webhook(http, mode, { storeId, url }));
		}
		for (const discountId of discountIds) {
			results.push(
				await validators.discount(http, mode, { storeId, discountId }),
			);
		}
		for (const licenseKeyId of licenseKeyIds) {
			results.push(
				await validators.licenseKey(http, mode, { storeId, licenseKeyId }),
			);
		}
		for (const variantId of variantIds) {
			results.push(
				await validators.subscriptionPlan(http, mode, { storeId, variantId }),
			);
		}
	}

	return { ok: results.every((entry) => entry.ok), mode, results };
};

const assertOptionsCoherent = (options: DoctorOptions): void => {
	if (options.storeId !== undefined) return;

	const dependent: Array<keyof DoctorOptions> = [];
	if (hasAny(options.webhookUrl, options.webhookUrls))
		dependent.push("webhookUrl");
	if (hasAny(options.discountId, options.discountIds))
		dependent.push("discountId");
	if (hasAny(options.licenseKeyId, options.licenseKeyIds))
		dependent.push("licenseKeyId");
	if (hasAny(options.variantId, options.variantIds))
		dependent.push("variantId");

	if (dependent.length === 0) return;

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
	if (single !== undefined) values.add(single);
	for (const value of many ?? []) {
		if (value !== undefined) values.add(value);
	}
	return Array.from(values);
};

const hasAny = <T>(single: T | undefined, many: T[] | undefined): boolean => {
	return single !== undefined || (many?.length ?? 0) > 0;
};
