import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: {
			index: "src/create-fresh-squeezy.ts",
			environment: "src/client/environment.ts",
			errors: "src/client/errors.ts",
			findings: "src/doctor/findings.ts",
			types: "src/client/lemon-squeezy-types.ts",
			license: "src/client/license-api.ts",
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
