import { defineConfig } from "tsdown";

export default defineConfig([
	{
		name: "library",
		entry: {
			index: "src/create-fresh-squeezy.ts",
			environment: "src/client/environment.ts",
			errors: "src/client/errors.ts",
			findings: "src/doctor/findings.ts",
			types: "src/client/lemon-squeezy-types.ts",
			license: "src/client/license-api.ts",
		},
		format: ["esm", "cjs"],
		fixedExtension: false,
		dts: { sourcemap: false },
		sourcemap: true,
		clean: true,
		target: "node22",
	},
	{
		name: "cli",
		entry: { cli: "src/cli.ts" },
		format: ["esm"],
		fixedExtension: false,
		dts: false,
		sourcemap: true,
		clean: false,
		target: "node22",
		banner: { js: "#!/usr/bin/env node" },
	},
]);
