import type { Mode, ValidationResult } from "@/contracts/contracts.js";
import type { DoctorValidators } from "@/validate/doctor.js";
import { buildResult } from "@/validate/issues.js";

export const createFakeValidators = (
	overrides: Partial<DoctorValidators> = {},
): DoctorValidators => {
	const ok = <T>(name: string, mode: Mode): ValidationResult<T> =>
		buildResult<T>(name, mode, []);

	const defaults: DoctorValidators = {
		connection: async (_http, mode) => ok("connection", mode),
		store: async (_http, mode) => ok("store", mode),
		product: async (_http, mode) => ok("product", mode),
		webhook: async (_http, mode) => ok("webhook", mode),
		discount: async (_http, mode) => ok("discount", mode),
		licenseKey: async (_http, mode) => ok("licenseKey", mode),
		subscriptionPlan: async (_http, mode) => ok("subscriptionPlan", mode),
	};

	return { ...defaults, ...overrides };
};
