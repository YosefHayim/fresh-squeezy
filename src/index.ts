// Pure wildcard barrel only — no named re-exports, no after-import shims.
// Layer order: generated → core → resources → validate → support → public client.

export * from "./generated/lemonSqueezyApiTypes.js";

export * from "./core/config.js";
export * from "./core/errors.js";
export * from "./core/types.js";

export * from "./resources/attributes.js";
export * from "./resources/registry.js";

export * from "./validate/connection.js";
export * from "./validate/discount.js";
export * from "./validate/doctor.js";
export * from "./validate/licenseKey.js";
export * from "./validate/product.js";
export * from "./validate/rules.js";
export * from "./validate/store.js";
export * from "./validate/subscriptionPlan.js";
export * from "./validate/webhook.js";

export * from "./support/manifest.js";

export * from "./augmentations.js";
export * from "./createFreshSqueezy.js";
