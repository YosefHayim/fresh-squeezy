import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@e2e": fileURLToPath(new URL("./e2e", import.meta.url)),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		globals: false,
		environment: "node",
		unstubEnvs: true,
		include: ["e2e/live-smoke.test.ts"],
		exclude: ["node_modules/**", "dist/**"],
	},
});
