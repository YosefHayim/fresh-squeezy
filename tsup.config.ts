import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: {
			index: "src/create-fresh-squeezy.ts",
			config: "src/shared/config.ts",
			errors: "src/shared/errors.ts",
			findings: "src/features/validate/findings.ts",
			types: "src/shared/lemon-squeezy-types.ts",
		},
		format: ["esm", "cjs"],
		dts: true,
		sourcemap: true,
		clean: true,
		target: "node22",
		splitting: false,
	},
	{
		entry: { cli: "src/cli.ts" },
		format: ["esm"],
		dts: false,
		sourcemap: true,
		clean: false,
		target: "node22",
		splitting: false,
		banner: { js: "#!/usr/bin/env node" },
	},
]);
