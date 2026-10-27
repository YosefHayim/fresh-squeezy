import { expect, inject, test } from "vitest";
import { createFreshSqueezy } from "@/create-fresh-squeezy.js";
import type { Mode } from "@/client/config.js";
import type { ResourceType } from "@/client/lemon-squeezy-types.js";
import { readAttributeKeys } from "./read-interface-keys.js";

declare module "vitest" {
	interface ProvidedContext {
		liveSmokeModes: Mode[];
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

const CONNECTION_TIMEOUT_MS = 15_000;

const ATTRIBUTE_KEYS_TIMEOUT_MS = 300_000;

const liveSmokeModes = inject("liveSmokeModes");
const isTestModeSmoked = liveSmokeModes.includes("test");
const isLiveModeSmoked = liveSmokeModes.includes("live");

const expectConnection = async (mode: Mode) => {
	const freshSqueezy = createFreshSqueezy({ mode });
	const connection = await freshSqueezy.validateConnection();
	expect(connection.ok).toBe(true);
	expect(connection.resource?.storeCount).toBeGreaterThan(0);
};

const expectKnownAttributeKeys = async (mode: Mode) => {
	const freshSqueezy = createFreshSqueezy({ mode });
	const attributeKeys = readAttributeKeys();
	const [storeId] = await freshSqueezy.listStoreIds();
	const resourceTypes = Object.keys(attributeKeys) as ResourceType[];
	const keysMissingFromInterfaces = new Set<string>();

	const checkAttributes = (type: ResourceType, attributes: object) => {
		const knownKeys = attributeKeys[type];
		const liveKeys = Object.keys(attributes);
		const unknownKeys = liveKeys.filter((key) => !knownKeys.includes(key));
		for (const key of unknownKeys)
			keysMissingFromInterfaces.add(`${type}.${key}`);
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

	expect([...keysMissingFromInterfaces]).toEqual([]);
};

test.runIf(isTestModeSmoked)(
	"a test-mode key authenticates and lists stores against the real API",
	() => expectConnection("test"),
	CONNECTION_TIMEOUT_MS,
);

test.runIf(isLiveModeSmoked)(
	"a live-mode key authenticates and lists stores against the real API",
	() => expectConnection("live"),
	CONNECTION_TIMEOUT_MS,
);

test.runIf(isTestModeSmoked)(
	"every test-mode attribute key exists in its interface",
	() => expectKnownAttributeKeys("test"),
	ATTRIBUTE_KEYS_TIMEOUT_MS,
);

test.runIf(isLiveModeSmoked)(
	"every live-mode attribute key exists in its interface",
	() => expectKnownAttributeKeys("live"),
	ATTRIBUTE_KEYS_TIMEOUT_MS,
);
