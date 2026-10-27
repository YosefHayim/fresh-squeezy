import { expect, inject, test } from "vitest";
import { createFreshSqueezy } from "@/create-fresh-squeezy.js";

declare module "vitest" {
	interface ProvidedContext {
		liveSmokeApiKey: string | undefined;
	}
}

const liveSmokeApiKey = inject("liveSmokeApiKey");
const isLiveSmokeEnabled = Boolean(liveSmokeApiKey);

test.runIf(isLiveSmokeEnabled)(
	"live smoke authenticates and lists stores against the real API",
	async () => {
		const lemon = createFreshSqueezy({ apiKey: liveSmokeApiKey });
		const connection = await lemon.validateConnection();
		expect(connection.ok).toBe(true);
		expect(connection.resource?.storeCount).toBeGreaterThan(0);
	},
	15_000,
);
