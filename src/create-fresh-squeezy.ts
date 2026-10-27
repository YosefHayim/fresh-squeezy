import type {
	DoctorReport,
	FreshSqueezyConfig,
	Mode,
	ValidationResult,
} from "@/contracts/contracts.js";
import { HttpClient, type RequestOptions } from "@/http/http.js";
import { resolveConfig } from "@/shared/config.js";
import type {
	DiscountAttributes,
	LicenseKeyAttributes,
	ProductAttributes,
	StoreAttributes,
	WebhookAttributes,
} from "./resources/attributes.js";
import {
	type InvokeOpArgs,
	invokeOp,
	type OpVerb,
} from "./resources/registry.js";
import {
	type ConnectionSummary,
	validateConnection,
} from "./validate/connection.js";
import {
	type DiscountValidationOptions,
	validateDiscount,
} from "./validate/discount.js";
import { type DoctorOptions, doctor } from "./validate/doctor.js";
import {
	type LicenseKeyValidationOptions,
	validateLicenseKey,
} from "./validate/license-key.js";
import {
	type ProductValidationOptions,
	validateProduct,
} from "./validate/product.js";
import { validateStore } from "./validate/store.js";
import {
	type SubscriptionPlanSummary,
	type SubscriptionPlanValidationOptions,
	validateSubscriptionPlan,
} from "./validate/subscription-plan.js";
import {
	validateWebhook,
	type WebhookValidationOptions,
} from "./validate/webhook.js";

export interface FreshSqueezyOps {
	users: {
		me: () => Promise<unknown>;
	};
	stores: {
		get: (id: string | number) => Promise<unknown>;
		list: () => Promise<unknown>;
	};
	products: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
	};
	variants: {
		get: (id: string | number) => Promise<unknown>;
		list: (productId: string | number) => Promise<unknown>;
	};
	prices: {
		get: (id: string | number) => Promise<unknown>;
		list: (variantId: string | number) => Promise<unknown>;
	};
	files: {
		get: (id: string | number) => Promise<unknown>;
		list: (variantId: string | number) => Promise<unknown>;
	};
	customers: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
		create: (body: unknown) => Promise<unknown>;
		update: (id: string | number, body: unknown) => Promise<unknown>;
	};
	orders: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
		refund: (id: string | number, body?: unknown) => Promise<unknown>;
		generateInvoice: (id: string | number, body?: unknown) => Promise<unknown>;
	};
	orderItems: {
		get: (id: string | number) => Promise<unknown>;
		list: (orderId: string | number) => Promise<unknown>;
	};
	subscriptions: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
		update: (id: string | number, body: unknown) => Promise<unknown>;
		cancel: (id: string | number) => Promise<unknown>;
	};
	subscriptionItems: {
		get: (id: string | number) => Promise<unknown>;
		list: (subscriptionId: string | number) => Promise<unknown>;
		update: (id: string | number, body: unknown) => Promise<unknown>;
		currentUsage: (id: string | number) => Promise<unknown>;
	};
	subscriptionInvoices: {
		get: (id: string | number) => Promise<unknown>;
		list: (subscriptionId: string | number) => Promise<unknown>;
		refund: (id: string | number, body?: unknown) => Promise<unknown>;
		generateInvoice: (id: string | number, body?: unknown) => Promise<unknown>;
	};
	usageRecords: {
		get: (id: string | number) => Promise<unknown>;
		list: (subscriptionItemId: string | number) => Promise<unknown>;
		create: (body: unknown) => Promise<unknown>;
	};
	discounts: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
		create: (body: unknown) => Promise<unknown>;
		delete: (id: string | number) => Promise<unknown>;
	};
	discountRedemptions: {
		get: (id: string | number) => Promise<unknown>;
		list: (discountId: string | number) => Promise<unknown>;
	};
	licenseKeys: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
		update: (id: string | number, body: unknown) => Promise<unknown>;
	};
	licenseKeyInstances: {
		get: (id: string | number) => Promise<unknown>;
		list: (licenseKeyId: string | number) => Promise<unknown>;
	};
	checkouts: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
		create: (body: unknown) => Promise<unknown>;
	};
	webhooks: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
		create: (body: unknown) => Promise<unknown>;
		update: (id: string | number, body: unknown) => Promise<unknown>;
		delete: (id: string | number) => Promise<unknown>;
	};
	affiliates: {
		get: (id: string | number) => Promise<unknown>;
		list: (storeId: string | number) => Promise<unknown>;
	};
}

export interface FreshSqueezyClient extends FreshSqueezyOps {
	readonly mode: Mode;

	request<T = unknown>(options: RequestOptions): Promise<T>;

	validateConnection(): Promise<ValidationResult<ConnectionSummary>>;
	validateStore(
		storeId: string | number,
	): Promise<ValidationResult<StoreAttributes>>;
	validateProduct(
		options: ProductValidationOptions,
	): Promise<ValidationResult<ProductAttributes>>;
	validateWebhook(
		options: WebhookValidationOptions,
	): Promise<ValidationResult<WebhookAttributes>>;
	validateDiscount(
		options: DiscountValidationOptions,
	): Promise<ValidationResult<DiscountAttributes>>;
	validateLicenseKey(
		options: LicenseKeyValidationOptions,
	): Promise<ValidationResult<LicenseKeyAttributes>>;
	validateSubscriptionPlan(
		options: SubscriptionPlanValidationOptions,
	): Promise<ValidationResult<SubscriptionPlanSummary>>;
	doctor(options?: DoctorOptions): Promise<DoctorReport>;
}

export const createFreshSqueezy = (
	config: FreshSqueezyConfig = {},
): FreshSqueezyClient => {
	const resolved = resolveConfig(config);
	const http = new HttpClient(resolved);

	const op = (resource: string, verb: OpVerb, args: InvokeOpArgs = {}) =>
		invokeOp(http, resource, verb, args);

	return {
		mode: resolved.mode,
		request: (options) => http.request(options),
		validateConnection: () => validateConnection(http, resolved.mode),
		validateStore: (storeId) => validateStore(http, resolved.mode, storeId),
		validateProduct: (options) => validateProduct(http, resolved.mode, options),
		validateWebhook: (options) => validateWebhook(http, resolved.mode, options),
		validateDiscount: (options) =>
			validateDiscount(http, resolved.mode, options),
		validateLicenseKey: (options) =>
			validateLicenseKey(http, resolved.mode, options),
		validateSubscriptionPlan: (options) =>
			validateSubscriptionPlan(http, resolved.mode, options),
		doctor: (options) =>
			doctor(http, resolved.mode, {
				...options,
				storeId: options?.storeId ?? resolved.storeId,
			}),

		users: {
			me: () => op("user", "get"),
		},
		stores: {
			get: (id) => op("store", "get", { id }),
			list: () => op("store", "list"),
		},
		products: {
			get: (id) => op("product", "get", { id }),
			list: (storeId) => op("product", "list", { storeId }),
		},
		variants: {
			get: (id) => op("variant", "get", { id }),
			list: (productId) => op("variant", "list", { parentId: productId }),
		},
		prices: {
			get: (id) => op("price", "get", { id }),
			list: (variantId) => op("price", "list", { parentId: variantId }),
		},
		files: {
			get: (id) => op("file", "get", { id }),
			list: (variantId) => op("file", "list", { parentId: variantId }),
		},
		customers: {
			get: (id) => op("customer", "get", { id }),
			list: (storeId) => op("customer", "list", { storeId }),
			create: (body) => op("customer", "create", { body }),
			update: (id, body) => op("customer", "update", { id, body }),
		},
		orders: {
			get: (id) => op("order", "get", { id }),
			list: (storeId) => op("order", "list", { storeId }),
			refund: (id, body) => op("order", "refund", { id, body }),
			generateInvoice: (id, body) =>
				op("order", "generate-invoice", { id, body }),
		},
		orderItems: {
			get: (id) => op("order-item", "get", { id }),
			list: (orderId) => op("order-item", "list", { parentId: orderId }),
		},
		subscriptions: {
			get: (id) => op("subscription", "get", { id }),
			list: (storeId) => op("subscription", "list", { storeId }),
			update: (id, body) => op("subscription", "update", { id, body }),
			cancel: (id) => op("subscription", "cancel", { id }),
		},
		subscriptionItems: {
			get: (id) => op("subscription-item", "get", { id }),
			list: (subscriptionId) =>
				op("subscription-item", "list", { parentId: subscriptionId }),
			update: (id, body) => op("subscription-item", "update", { id, body }),
			currentUsage: (id) => op("subscription-item", "current-usage", { id }),
		},
		subscriptionInvoices: {
			get: (id) => op("subscription-invoice", "get", { id }),
			list: (subscriptionId) =>
				op("subscription-invoice", "list", { parentId: subscriptionId }),
			refund: (id, body) => op("subscription-invoice", "refund", { id, body }),
			generateInvoice: (id, body) =>
				op("subscription-invoice", "generate-invoice", { id, body }),
		},
		usageRecords: {
			get: (id) => op("usage-record", "get", { id }),
			list: (subscriptionItemId) =>
				op("usage-record", "list", { parentId: subscriptionItemId }),
			create: (body) => op("usage-record", "create", { body }),
		},
		discounts: {
			get: (id) => op("discount", "get", { id }),
			list: (storeId) => op("discount", "list", { storeId }),
			create: (body) => op("discount", "create", { body }),
			delete: (id) => op("discount", "delete", { id }),
		},
		discountRedemptions: {
			get: (id) => op("discount-redemption", "get", { id }),
			list: (discountId) =>
				op("discount-redemption", "list", { parentId: discountId }),
		},
		licenseKeys: {
			get: (id) => op("license-key", "get", { id }),
			list: (storeId) => op("license-key", "list", { storeId }),
			update: (id, body) => op("license-key", "update", { id, body }),
		},
		licenseKeyInstances: {
			get: (id) => op("license-key-instance", "get", { id }),
			list: (licenseKeyId) =>
				op("license-key-instance", "list", { parentId: licenseKeyId }),
		},
		checkouts: {
			get: (id) => op("checkout", "get", { id }),
			list: (storeId) => op("checkout", "list", { storeId }),
			create: (body) => op("checkout", "create", { body }),
		},
		webhooks: {
			get: (id) => op("webhook", "get", { id }),
			list: (storeId) => op("webhook", "list", { storeId }),
			create: (body) => op("webhook", "create", { body }),
			update: (id, body) => op("webhook", "update", { id, body }),
			delete: (id) => op("webhook", "delete", { id }),
		},
		affiliates: {
			get: (id) => op("affiliate", "get", { id }),
			list: (storeId) => op("affiliate", "list", { storeId }),
		},
	};
};
