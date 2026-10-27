import type {
	DoctorReport,
	Mode,
	ResourceId,
	ValidationResult,
} from "@/shared/contracts.js";
import { freshSqueezyErrorOf } from "@/shared/errors.js";
import type { HttpClient } from "@/shared/http.js";
import { validateConnection } from "./connection.js";
import { validateDiscount } from "./discount.js";
import { validateLicenseKey } from "./license-key.js";
import { validateProduct } from "./product.js";
import { validateStore } from "./store.js";
import { validateSubscriptionPlan } from "./subscription-plan.js";
import { validateWebhook } from "./webhook.js";

export interface DoctorOptions {
	storeId?: ResourceId;
	productIds?: ResourceId[];
	webhookUrls?: string[];
	discountIds?: ResourceId[];
	licenseKeyIds?: ResourceId[];
	variantIds?: ResourceId[];
}

export interface DoctorValidators {
	connection: typeof validateConnection;
	store: typeof validateStore;
	product: typeof validateProduct;
	webhook: typeof validateWebhook;
	discount: typeof validateDiscount;
	licenseKey: typeof validateLicenseKey;
	subscriptionPlan: typeof validateSubscriptionPlan;
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
	const { storeId } = options;
	const { productIds = [], webhookUrls = [], discountIds = [] } = options;
	const { licenseKeyIds = [], variantIds = [] } = options;
	assertStoreGivenForDependents(storeId, {
		webhookUrls,
		discountIds,
		licenseKeyIds,
		variantIds,
	});

	const connection = await validators.connection(http, mode);
	const results: ValidationResult[] = [connection];
	const isConnectionFailed = !connection.ok;
	if (isConnectionFailed) return { ok: false, mode, results };

	const isStoreGiven = storeId !== undefined;
	const storeJobs: Job[] = isStoreGiven
		? [() => validators.store(http, mode, storeId)]
		: [];
	const productJobs: Job[] = productIds.map(
		(productId) => () =>
			validators.product(http, mode, { productId, expectedStoreId: storeId }),
	);
	// The dependent lists are empty without a store (asserted above).
	const storeBoundJobs: Job[] = isStoreGiven
		? [
				...webhookUrls.map(
					(url) => () => validators.webhook(http, mode, { storeId, url }),
				),
				...discountIds.map(
					(discountId) => () =>
						validators.discount(http, mode, { storeId, discountId }),
				),
				...licenseKeyIds.map(
					(licenseKeyId) => () =>
						validators.licenseKey(http, mode, { storeId, licenseKeyId }),
				),
				...variantIds.map(
					(variantId) => () =>
						validators.subscriptionPlan(http, mode, { storeId, variantId }),
				),
			]
		: [];

	for (const runJob of [...storeJobs, ...productJobs, ...storeBoundJobs]) {
		const jobResult = await runJob();
		results.push(jobResult);
	}

	const isEveryResultOk = results.every((entry) => entry.ok);
	return { ok: isEveryResultOk, mode, results };
};

type Job = () => Promise<ValidationResult>;

const assertStoreGivenForDependents = (
	storeId: DoctorOptions["storeId"],
	dependentValues: Record<string, unknown[]>,
): void => {
	const isStoreGiven = storeId !== undefined;
	if (isStoreGiven) return;

	const dependent = Object.entries(dependentValues)
		.filter(([, values]) => values.length > 0)
		.map(([name]) => name);

	const isEverythingCoherent = dependent.length === 0;
	if (isEverythingCoherent) return;

	throw freshSqueezyErrorOf({
		code: "DOCTOR_OPTIONS_INVALID",
		message: `doctor() received ${dependent.join(", ")} without storeId. These validators cannot run without a store; pass \`storeId\` or remove the dependent options.`,
	});
};
