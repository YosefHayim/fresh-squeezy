import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: {
			index: "src/create-fresh-squeezy.ts",
			errors: "src/shared/errors.ts",
			config: "src/shared/config.ts",
			types: "src/shared/contracts.ts",
			"api-types": "src/shared/lemon-squeezy-api-types.ts",
			"resources/attributes": "src/shared/attributes.ts",
			"resources/registry": "src/features/ops/resource-registry.ts",
			"validate/connection": "src/features/validate/connection.ts",
			"validate/discount": "src/features/validate/discount.ts",
			"validate/doctor": "src/features/validate/doctor.ts",
			"validate/license-key": "src/features/validate/license-key.ts",
			"validate/product": "src/features/validate/product.ts",
			"validate/issues": "src/features/validate/issues.ts",
			"validate/store": "src/features/validate/store.ts",
			"validate/subscription-plan":
				"src/features/validate/subscription-plan.ts",
			"validate/webhook": "src/features/validate/webhook.ts",
			manifest: "src/shared/support-manifest.ts",
			augmentations: "src/augmentations.ts",
		},
		format: ["esm", "cjs"],
		dts: true,
		sourcemap: true,
		clean: true,
		target: "node20",
		splitting: false,
	},
	{
		entry: { cli: "src/cli.ts" },
		format: ["esm"],
		dts: false,
		sourcemap: true,
		clean: false,
		target: "node20",
		splitting: false,
		banner: { js: "#!/usr/bin/env node" },
	},
]);
