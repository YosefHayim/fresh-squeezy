import { expect, inject, test } from "vitest";
import { createFreshSqueezy } from "@/create-fresh-squeezy.js";
import type { ResourceType } from "@/shared/lemon-squeezy-types.js";
import { readAttributeKeys } from "./read-interface-keys.js";

declare module "vitest" {
	interface ProvidedContext {
		liveSmokeApiKey: string | undefined;
	}
}

const STORE_SCOPED_RESOURCES: ResourceType[] = [
	"customers",
	"products",
	"orders",
	"subscriptions",
	"subscription-invoices",
	"discounts",
	"license-keys",
	"checkouts",
	"webhooks",
	"affiliates",
];

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

test.runIf(isLiveSmokeEnabled)(
	"every live attribute key exists in its interface",
	async () => {
		const freshSqueezy = createFreshSqueezy({ apiKey: liveSmokeApiKey });
		const attributeKeys = readAttributeKeys();
		const [storeId] = await freshSqueezy.listStoreIds();
		const resourceTypes = Object.keys(attributeKeys) as ResourceType[];
		const keysMissingFromInterfaces: string[] = [];

		const checkAttributes = (type: ResourceType, attributes: object) => {
			const knownKeys = attributeKeys[type];
			const liveKeys = Object.keys(attributes);
			const unknownKeys = liveKeys.filter((key) => !knownKeys.includes(key));
			for (const key of unknownKeys)
				keysMissingFromInterfaces.push(`${type}.${key}`);
		};

		const firstResourceOf = async (type: ResourceType) => {
			const isUsers = type === "users";
			if (isUsers) return freshSqueezy.get("users", "me");
			const isStoreScoped = STORE_SCOPED_RESOURCES.includes(type);
			const filter = isStoreScoped ? { store_id: Number(storeId) } : undefined;
			const listed = await freshSqueezy.list(type, filter);
			const [first] = listed;
			const isListEmpty = first === undefined;
			if (isListEmpty) return undefined;
			checkAttributes(type, first.attributes as object);
			return freshSqueezy.get(type, first.id);
		};

		for (const type of resourceTypes) {
			const firstResource = await firstResourceOf(type);
			if (firstResource)
				checkAttributes(type, firstResource.attributes as object);
		}

		expect(keysMissingFromInterfaces).toEqual([]);
	},
	300_000,
);
