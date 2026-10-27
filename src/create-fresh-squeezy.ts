import { resolveConfig } from "@/shared/config.js";
import type {
	DoctorReport,
	FreshSqueezyConfig,
	Mode,
	ResourceId,
} from "@/shared/contracts.js";
import { HttpClient, type RequestOptions } from "@/shared/http.js";
import {
	type InvokeOpArgs,
	invokeOp,
	type OpVerb,
} from "./features/ops/resource-registry.js";
import { validateConnection } from "./features/validate/connection.js";
import { validateDiscount } from "./features/validate/discount.js";
import { type DoctorOptions, doctor } from "./features/validate/doctor.js";
import { validateLicenseKey } from "./features/validate/license-key.js";
import { validateProduct } from "./features/validate/product.js";
import { validateStore } from "./features/validate/store.js";
import { validateSubscriptionPlan } from "./features/validate/subscription-plan.js";
import { validateWebhook } from "./features/validate/webhook.js";

type OpCaller = (
	resource: string,
	verb: OpVerb,
	args?: InvokeOpArgs,
) => Promise<unknown>;

const byId = (op: OpCaller, resource: string, verb: OpVerb = "get") => {
	return (id: ResourceId) => op(resource, verb, { id });
};
const listInStore = (op: OpCaller, resource: string) => {
	return (storeId: ResourceId) => op(resource, "list", { storeId });
};
const listUnder = (op: OpCaller, resource: string) => {
	return (parentId: ResourceId) => op(resource, "list", { parentId });
};
const create = (op: OpCaller, resource: string) => {
	return (body: unknown) => op(resource, "create", { body });
};
const update = (op: OpCaller, resource: string) => {
	return (id: ResourceId, body: unknown) =>
		op(resource, "update", { id, body });
};
const withOptionalBody = (op: OpCaller, resource: string, verb: OpVerb) => {
	return (id: ResourceId, body?: unknown) => op(resource, verb, { id, body });
};

const buildCatalogOps = (op: OpCaller) => ({
	users: { me: () => op("user", "get") },
	stores: { get: byId(op, "store"), list: () => op("store", "list") },
	products: { get: byId(op, "product"), list: listInStore(op, "product") },
	variants: { get: byId(op, "variant"), list: listUnder(op, "variant") },
	prices: { get: byId(op, "price"), list: listUnder(op, "price") },
	files: { get: byId(op, "file"), list: listUnder(op, "file") },
	affiliates: {
		get: byId(op, "affiliate"),
		list: listInStore(op, "affiliate"),
	},
});

const buildSalesOps = (op: OpCaller) => ({
	customers: {
		get: byId(op, "customer"),
		list: listInStore(op, "customer"),
		create: create(op, "customer"),
		update: update(op, "customer"),
	},
	orders: {
		get: byId(op, "order"),
		list: listInStore(op, "order"),
		refund: withOptionalBody(op, "order", "refund"),
		generateInvoice: withOptionalBody(op, "order", "generate-invoice"),
	},
	orderItems: {
		get: byId(op, "order-item"),
		list: listUnder(op, "order-item"),
	},
	discounts: {
		get: byId(op, "discount"),
		list: listInStore(op, "discount"),
		create: create(op, "discount"),
		delete: byId(op, "discount", "delete"),
	},
	discountRedemptions: {
		get: byId(op, "discount-redemption"),
		list: listUnder(op, "discount-redemption"),
	},
	checkouts: {
		get: byId(op, "checkout"),
		list: listInStore(op, "checkout"),
		create: create(op, "checkout"),
	},
});

const buildSubscriptionOps = (op: OpCaller) => ({
	subscriptions: {
		get: byId(op, "subscription"),
		list: listInStore(op, "subscription"),
		update: update(op, "subscription"),
		cancel: byId(op, "subscription", "cancel"),
	},
	subscriptionItems: {
		get: byId(op, "subscription-item"),
		list: listUnder(op, "subscription-item"),
		update: update(op, "subscription-item"),
		currentUsage: byId(op, "subscription-item", "current-usage"),
	},
	subscriptionInvoices: {
		get: byId(op, "subscription-invoice"),
		list: listUnder(op, "subscription-invoice"),
		refund: withOptionalBody(op, "subscription-invoice", "refund"),
		generateInvoice: withOptionalBody(
			op,
			"subscription-invoice",
			"generate-invoice",
		),
	},
	usageRecords: {
		get: byId(op, "usage-record"),
		list: listUnder(op, "usage-record"),
		create: create(op, "usage-record"),
	},
});

const buildAccessOps = (op: OpCaller) => ({
	licenseKeys: {
		get: byId(op, "license-key"),
		list: listInStore(op, "license-key"),
		update: update(op, "license-key"),
	},
	licenseKeyInstances: {
		get: byId(op, "license-key-instance"),
		list: listUnder(op, "license-key-instance"),
	},
	webhooks: {
		get: byId(op, "webhook"),
		list: listInStore(op, "webhook"),
		create: create(op, "webhook"),
		update: update(op, "webhook"),
		delete: byId(op, "webhook", "delete"),
	},
});

const buildOps = (op: OpCaller) => ({
	...buildCatalogOps(op),
	...buildSalesOps(op),
	...buildSubscriptionOps(op),
	...buildAccessOps(op),
});

export type FreshSqueezyOps = ReturnType<typeof buildOps>;

type Bound<Validator> = Validator extends (
	http: HttpClient,
	mode: Mode,
	...rest: infer Rest
) => infer Outcome
	? (...rest: Rest) => Outcome
	: never;

export interface FreshSqueezyClient extends FreshSqueezyOps {
	readonly mode: Mode;

	request<T = unknown>(options: RequestOptions): Promise<T>;

	validateConnection: Bound<typeof validateConnection>;
	validateStore: Bound<typeof validateStore>;
	validateProduct: Bound<typeof validateProduct>;
	validateWebhook: Bound<typeof validateWebhook>;
	validateDiscount: Bound<typeof validateDiscount>;
	validateLicenseKey: Bound<typeof validateLicenseKey>;
	validateSubscriptionPlan: Bound<typeof validateSubscriptionPlan>;
	doctor(options?: DoctorOptions): Promise<DoctorReport>;
}

export const createFreshSqueezy = (
	config: FreshSqueezyConfig = {},
): FreshSqueezyClient => {
	const resolved = resolveConfig(config);
	const http = new HttpClient(resolved);

	const op = (resource: string, verb: OpVerb, args: InvokeOpArgs = {}) =>
		invokeOp(http, resource, verb, args);

	const bind =
		<Rest extends unknown[], Outcome>(
			validator: (http: HttpClient, mode: Mode, ...rest: Rest) => Outcome,
		) =>
		(...rest: Rest): Outcome =>
			validator(http, resolved.mode, ...rest);

	return {
		mode: resolved.mode,
		request: (options) => http.request(options),
		validateConnection: bind(validateConnection),
		validateStore: bind(validateStore),
		validateProduct: bind(validateProduct),
		validateWebhook: bind(validateWebhook),
		validateDiscount: bind(validateDiscount),
		validateLicenseKey: bind(validateLicenseKey),
		validateSubscriptionPlan: bind(validateSubscriptionPlan),
		doctor: (options) =>
			doctor(http, resolved.mode, {
				...options,
				storeId: options?.storeId ?? resolved.storeId,
			}),
		...buildOps(op),
	};
};
