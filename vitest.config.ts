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
		include: ["src/**/*.test.ts", "e2e/**/*.e2e.test.ts"],
		exclude: ["node_modules/**", "dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["src/**/*.ts"],
			exclude: [
				"**/*.test.ts",
				"src/cli/main.ts",
				"src/cli/prompts.ts",
				"src/cli/commands/init.ts",
				"src/contracts/contracts.ts",
				"**/*.d.ts",
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 75,
				statements: 80,
			},
		},
	},
});
