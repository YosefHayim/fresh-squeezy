import { validateConnection } from "./features/validate/connection.js";
import {
	type DiscountCheck,
	validateDiscount,
} from "./features/validate/discount.js";
import {
	type DoctorOptions,
	doctor,
	listStoreIds,
} from "./features/validate/doctor.js";
import {
	type LicenseKeyCheck,
	validateLicenseKey,
} from "./features/validate/license-key.js";
import {
	type ProductCheck,
	validateProduct,
} from "./features/validate/product.js";
import { validateStore } from "./features/validate/store.js";
import {
	type SubscriptionPlanCheck,
	validateSubscriptionPlan,
} from "./features/validate/subscription-plan.js";
import {
	validateWebhook,
	type WebhookCheck,
} from "./features/validate/webhook.js";
import { type FreshSqueezyConfig, readConfig } from "./shared/config.js";
import { createHttp } from "./shared/http.js";

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
