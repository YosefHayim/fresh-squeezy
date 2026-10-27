import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const e2eUrl = new URL("./e2e", import.meta.url);
const srcUrl = new URL("./src", import.meta.url);

export default defineConfig({
	resolve: {
		alias: {
			"@e2e": fileURLToPath(e2eUrl),
			"@": fileURLToPath(srcUrl),
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
				"src/cli.ts",
				"src/client/lemon-squeezy-types.ts",
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
