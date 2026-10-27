import { createLemonSqueezyClient } from "@/client/lemon-squeezy-client.js";
import { validateConnection } from "@/doctor/connection.js";
import {
	type DiscountCheck,
	validateDiscount,
} from "@/doctor/discount.js";
import {
	type DoctorOptions,
	doctor,
	listStoreIds,
} from "@/doctor/doctor.js";
import {
	type LicenseKeyCheck,
	validateLicenseKey,
} from "@/doctor/license-key.js";
import {
	type ProductCheck,
	validateProduct,
} from "@/doctor/product.js";
import { validateStore } from "@/doctor/store.js";
import {
	type SubscriptionPlanCheck,
	validateSubscriptionPlan,
} from "@/doctor/subscription-plan.js";
import {
	validateWebhook,
	type WebhookCheck,
} from "@/doctor/webhook.js";
import { type FreshSqueezyConfig, readConfig } from "@/client/config.js";
import { createHttp } from "@/client/http.js";

export const createFreshSqueezy = (input: FreshSqueezyConfig = {}) => {
	const config = readConfig(input);
	const http = createHttp(config);
	const { mode, storeId } = config;

	const storeIdsToCheck = async () => {
		const isStoreSet = storeId !== undefined;
		if (isStoreSet) return [storeId];
		return listStoreIds(http);
	};

	return {
		...createLemonSqueezyClient(http),
		mode,
		validateConnection: () => validateConnection(http, mode),
		validateStore: (id: string) => validateStore(http, mode, id),
		validateProduct: (check: ProductCheck) =>
			validateProduct(http, mode, check),
		validateWebhook: (check: WebhookCheck) =>
			validateWebhook(http, mode, check),
		validateDiscount: (check: DiscountCheck) =>
			validateDiscount(http, mode, check),
		validateLicenseKey: (check: LicenseKeyCheck) =>
			validateLicenseKey(http, mode, check),
		validateSubscriptionPlan: (check: SubscriptionPlanCheck) =>
			validateSubscriptionPlan(http, mode, check),
		listStoreIds: storeIdsToCheck,
		doctor: (options: DoctorOptions = {}) =>
			doctor(http, mode, { storeId, ...options }),
	};
};

export type FreshSqueezy = ReturnType<typeof createFreshSqueezy>;
