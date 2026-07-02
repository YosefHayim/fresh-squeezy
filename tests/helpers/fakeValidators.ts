import type { Mode, ValidationResult } from "../../src/core/types.js";
import type { DoctorValidators } from "../../src/validate/doctor.js";
import { buildResult } from "../../src/validate/rules.js";

/**
 * Build a `DoctorValidators` object with passing defaults. Override only the
 * validators whose behavior the test under examination cares about — the rest
 * return an OK `ValidationResult` so composition logic can be exercised
 * without setting up HTTP routes.
 *
 * The defaults omit the `resource` field because composition tests rarely
 * inspect it; tests that need a populated resource can supply their own
 * override.
 */
export function createFakeValidators(overrides: Partial<DoctorValidators> = {}): DoctorValidators {
  const ok = <T>(name: string, mode: Mode): ValidationResult<T> => buildResult<T>(name, mode, []);

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
}
