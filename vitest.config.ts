import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcUrl = new URL("./src", import.meta.url);

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(srcUrl),
		},
	},
	test: {
		globals: false,
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		unstubEnvs: true,
		include: ["src/**/*.test.ts", "e2e/**/*.e2e.test.ts"],
		exclude: ["node_modules/**", "dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: [
				"src/doctor/*.ts",
				"src/client/environment.ts",
				"src/client/errors.ts",
				"src/client/lemon-squeezy-client.ts",
			],
			exclude: ["**/*.test.ts"],
			thresholds: { branches: 100 },
		},
	},
});
