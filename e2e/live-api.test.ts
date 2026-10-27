import { describe, expect, inject, test } from "vitest";
import type { Mode } from "@/client/environment.js";
import type { ResourceType } from "@/client/lemon-squeezy-types.js";
import { createFreshSqueezy } from "@/create-fresh-squeezy.js";
import { readAttributeKeys } from "./read-interface-keys.js";

declare module "vitest" {
	interface ProvidedContext {
		liveApiModes: Mode[];
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

const liveApiModes = inject("liveApiModes");
const isTestModeChecked = liveApiModes.includes("test");
const isLiveModeChecked = liveApiModes.includes("live");

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
	const typeNames = Object.keys(attributeKeys);
	const isResourceType = (typeName: string): typeName is ResourceType =>
		typeName in attributeKeys;
	const resourceTypes = typeNames.filter(isResourceType);
	const keysMissingFromInterfaces = new Set<string>();

	const checkAttributes = (type: ResourceType, attributes: object) => {
		const knownKeys = attributeKeys[type];
		const liveKeys = Object.keys(attributes);
		const unknownKeys = liveKeys.filter((key) => !knownKeys.includes(key));
		for (const key of unknownKeys)
			keysMissingFromInterfaces.add(`${type}.${key}`);
	};

	const fetchFirstResource = async (type: ResourceType) => {
		const isUsers = type === "users";
		if (isUsers) return freshSqueezy.get("users", "me");
		const isStoreScoped = STORE_SCOPED_RESOURCES.includes(type);
		const filter = isStoreScoped ? { store_id: Number(storeId) } : undefined;
		const listed = await freshSqueezy.list(type, filter);
		const [first] = listed;
		const isListEmpty = first === undefined;
		if (isListEmpty) return null;
		checkAttributes(type, first.attributes);
		return freshSqueezy.get(type, first.id);
	};

	for (const type of resourceTypes) {
		const firstResource = await fetchFirstResource(type);
		const isResourceFound = firstResource !== null;
		if (isResourceFound) checkAttributes(type, firstResource.attributes);
	}

	expect([...keysMissingFromInterfaces]).toEqual([]);
};

describe("createFreshSqueezy", () => {
	test.runIf(isTestModeChecked)(
		"a test-mode key authenticates and lists stores against the real API",
		() => expectConnection("test"),
		CONNECTION_TIMEOUT_MS,
	);

	test.runIf(isLiveModeChecked)(
		"a live-mode key authenticates and lists stores against the real API",
		() => expectConnection("live"),
		CONNECTION_TIMEOUT_MS,
	);
});

describe("readAttributeKeys", () => {
	test.runIf(isTestModeChecked)(
		"every test-mode attribute key exists in its interface",
		() => expectKnownAttributeKeys("test"),
		ATTRIBUTE_KEYS_TIMEOUT_MS,
	);

	test.runIf(isLiveModeChecked)(
		"every live-mode attribute key exists in its interface",
		() => expectKnownAttributeKeys("live"),
		ATTRIBUTE_KEYS_TIMEOUT_MS,
	);
});
