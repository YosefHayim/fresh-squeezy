import { describe, expect, inject, test } from "vitest";
import type { Mode } from "@/client/environment.js";
import type { ResourceType } from "@/client/lemon-squeezy-types.js";
import { createFreshSqueezy } from "@/create-fresh-squeezy.js";
import { readAttributeKeys } from "./read-interface-keys.js";

const TEST_MODE = "test";
const LIVE_MODE = "live";
const USERS_RESOURCE_TYPE = "users";
const CONNECTION_TIMEOUT_MILLISECONDS = 15_000;
const ATTRIBUTE_KEYS_TIMEOUT_MILLISECONDS = 300_000;

declare module "vitest" {
	interface ProvidedContext {
		liveApiModes: Mode[];
	}
}

const liveApiModes = inject("liveApiModes");
const isTestModeChecked = liveApiModes.includes(TEST_MODE);
const isLiveModeChecked = liveApiModes.includes(LIVE_MODE);

const expectConnection = async (mode: Mode) => {
	const freshSqueezy = createFreshSqueezy({ mode });

	const connection = await freshSqueezy.validateConnection();

	expect(connection.ok).toBe(true);
	expect(connection.resource?.storeCount).toBeGreaterThan(0);
};

const expectKnownAttributeKeys = async (mode: Mode) => {
	const freshSqueezy = createFreshSqueezy({ mode });
	const attributeKeysByType = readAttributeKeys();
	const [storeId] = await freshSqueezy.listStoreIds();
	const keysMissingFromInterfaces = new Set<string>();

	const checkAttributes = (
		type: ResourceType,
		knownKeys: string[],
		attributes: object,
	) => {
		const liveKeys = Object.keys(attributes);
		const unknownKeys = liveKeys.filter((key) => !knownKeys.includes(key));

		for (const key of unknownKeys)
			keysMissingFromInterfaces.add(`${type}.${key}`);
	};

	const fetchFirstResource = async (
		type: ResourceType,
		knownKeys: string[],
	) => {
		const isUsers = type === USERS_RESOURCE_TYPE;
		if (isUsers) return freshSqueezy.get(USERS_RESOURCE_TYPE, "me");

		const isStoreScoped = [
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
		].includes(type);
		const filter = isStoreScoped ? { store_id: Number(storeId) } : undefined;

		const resourceList = await freshSqueezy.list(type, filter);
		const [firstListedResource] = resourceList;
		const isListEmpty = firstListedResource == null;
		if (isListEmpty) return null;

		checkAttributes(type, knownKeys, firstListedResource.attributes);
		return freshSqueezy.get(type, firstListedResource.id);
	};

	const isResourceType = (typeName: string): typeName is ResourceType =>
		typeName in attributeKeysByType;

	for (const [typeName, knownKeys] of Object.entries(attributeKeysByType)) {
		const isTypeUnknown = !isResourceType(typeName);
		if (isTypeUnknown) throw new Error(`${typeName} is not a resource type`);

		const firstResource = await fetchFirstResource(typeName, knownKeys);

		const isResourceFound = firstResource != null;
		if (isResourceFound)
			checkAttributes(typeName, knownKeys, firstResource.attributes);
	}

	expect([...keysMissingFromInterfaces]).toEqual([]);
};

describe("createFreshSqueezy", () => {
	test.runIf(isTestModeChecked)(
		"a test-mode key authenticates and lists stores against the real API",
		() => expectConnection(TEST_MODE),
		CONNECTION_TIMEOUT_MILLISECONDS,
	);

	test.runIf(isLiveModeChecked)(
		"a live-mode key authenticates and lists stores against the real API",
		() => expectConnection(LIVE_MODE),
		CONNECTION_TIMEOUT_MILLISECONDS,
	);
});

describe("readAttributeKeys", () => {
	test.runIf(isTestModeChecked)(
		"every test-mode attribute key exists in its interface",
		() => expectKnownAttributeKeys(TEST_MODE),
		ATTRIBUTE_KEYS_TIMEOUT_MILLISECONDS,
	);

	test.runIf(isLiveModeChecked)(
		"every live-mode attribute key exists in its interface",
		() => expectKnownAttributeKeys(LIVE_MODE),
		ATTRIBUTE_KEYS_TIMEOUT_MILLISECONDS,
	);
});
