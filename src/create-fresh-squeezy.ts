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

const buildOps = (op: OpCaller) => {
	const byId = (resource: string, verb: OpVerb = "get") => {
		return (id: ResourceId) => op(resource, verb, { id });
	};
	const listInStore = (resource: string) => {
		return (storeId: ResourceId) => op(resource, "list", { storeId });
	};
	const listUnder = (resource: string) => {
		return (parentId: ResourceId) => op(resource, "list", { parentId });
	};
	const create = (resource: string) => {
		return (body: unknown) => op(resource, "create", { body });
	};
	const update = (resource: string) => {
		return (id: ResourceId, body: unknown) =>
			op(resource, "update", { id, body });
	};
	const withOptionalBody = (resource: string, verb: OpVerb) => {
		return (id: ResourceId, body?: unknown) => op(resource, verb, { id, body });
	};

	return {
		users: { me: () => op("user", "get") },
		stores: { get: byId("store"), list: () => op("store", "list") },
		products: { get: byId("product"), list: listInStore("product") },
		variants: { get: byId("variant"), list: listUnder("variant") },
		prices: { get: byId("price"), list: listUnder("price") },
		files: { get: byId("file"), list: listUnder("file") },
		customers: {
			get: byId("customer"),
			list: listInStore("customer"),
			create: create("customer"),
			update: update("customer"),
		},
		orders: {
			get: byId("order"),
			list: listInStore("order"),
			refund: withOptionalBody("order", "refund"),
			generateInvoice: withOptionalBody("order", "generate-invoice"),
		},
		orderItems: { get: byId("order-item"), list: listUnder("order-item") },
		subscriptions: {
			get: byId("subscription"),
			list: listInStore("subscription"),
			update: update("subscription"),
			cancel: byId("subscription", "cancel"),
		},
		subscriptionItems: {
			get: byId("subscription-item"),
			list: listUnder("subscription-item"),
			update: update("subscription-item"),
			currentUsage: byId("subscription-item", "current-usage"),
		},
		subscriptionInvoices: {
			get: byId("subscription-invoice"),
			list: listUnder("subscription-invoice"),
			refund: withOptionalBody("subscription-invoice", "refund"),
			generateInvoice: withOptionalBody(
				"subscription-invoice",
				"generate-invoice",
			),
		},
		usageRecords: {
			get: byId("usage-record"),
			list: listUnder("usage-record"),
			create: create("usage-record"),
		},
		discounts: {
			get: byId("discount"),
			list: listInStore("discount"),
			create: create("discount"),
			delete: byId("discount", "delete"),
		},
		discountRedemptions: {
			get: byId("discount-redemption"),
			list: listUnder("discount-redemption"),
		},
		licenseKeys: {
			get: byId("license-key"),
			list: listInStore("license-key"),
			update: update("license-key"),
		},
		licenseKeyInstances: {
			get: byId("license-key-instance"),
			list: listUnder("license-key-instance"),
		},
		checkouts: {
			get: byId("checkout"),
			list: listInStore("checkout"),
			create: create("checkout"),
		},
		webhooks: {
			get: byId("webhook"),
			list: listInStore("webhook"),
			create: create("webhook"),
			update: update("webhook"),
			delete: byId("webhook", "delete"),
		},
		affiliates: { get: byId("affiliate"), list: listInStore("affiliate") },
	};
};

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
