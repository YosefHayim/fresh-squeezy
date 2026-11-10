const USERS_ME_PATH = "/v1/users/me";

const createVariant = (id, productId, overrides) => ({
	type: "variants",
	id,
	attributes: {
		product_id: productId,
		name: `Plan ${id}`,
		slug: `plan-${id}`,
		status: "published",
		is_subscription: true,
		interval: "month",
		interval_count: 1,
		has_free_trial: false,
		trial_interval: null,
		trial_interval_count: null,
		price: 1900,
		...overrides,
	},
});

const createDiscount = (id, storeId, overrides) => ({
	type: "discounts",
	id,
	attributes: {
		name: `Discount ${id}`,
		code: `CODE${id}`,
		amount: 20,
		amount_type: "percent",
		is_limited_to_products: false,
		is_limited_redemptions: false,
		max_redemptions: 0,
		starts_at: null,
		expires_at: "2099-12-31T23:59:59Z",
		status: "published",
		duration: "once",
		store_id: storeId,
		...overrides,
	},
});

const tablesByResourceType = {
	stores: [
		{ type: "stores", id: "1", attributes: { name: "Store One", slug: "one" } },
		{ type: "stores", id: "2", attributes: { name: "Store Two", slug: "two" } },
	],
	products: [
		{
			type: "products",
			id: "100",
			attributes: {
				name: "Pro",
				status: "published",
				store_id: 1,
				buy_now_url: "https://one.example.com/buy",
			},
		},
		{
			type: "products",
			id: "200",
			attributes: {
				name: "Team",
				status: "draft",
				store_id: 2,
				buy_now_url: "https://two.example.com/buy",
			},
		},
	],
	variants: [
		createVariant("800", 100, {}),
		createVariant("801", 100, { price: 0 }),
		createVariant("802", 100, { interval_count: undefined }),
		createVariant("900", 200, {}),
	],
	webhooks: [
		{
			type: "webhooks",
			id: "50",
			attributes: {
				store_id: 1,
				url: "https://good.example.com/hook",
				events: [
					"order_created",
					"order_refunded",
					"subscription_created",
					"subscription_updated",
					"subscription_cancelled",
					"subscription_resumed",
					"subscription_expired",
					"subscription_payment_success",
					"subscription_payment_failed",
				],
			},
		},
		{
			type: "webhooks",
			id: "51",
			attributes: {
				store_id: 2,
				url: "https://two.example.com/hook",
				events: ["order_created"],
			},
		},
	],
	discounts: [
		createDiscount("600", 1, {}),
		createDiscount("601", 1, { expires_at: "2020-01-01T00:00:00Z" }),
		createDiscount("610", 2, { status: "draft" }),
	],
	"license-keys": [
		{
			type: "license-keys",
			id: "700",
			attributes: {
				store_id: 1,
				key_short: "abcd",
				status: "active",
				expires_at: null,
				activation_limit: 5,
				instances_count: 1,
				disabled: false,
			},
		},
		{
			type: "license-keys",
			id: "710",
			attributes: {
				store_id: 2,
				key_short: "wxyz",
				status: "disabled",
				expires_at: null,
				activation_limit: null,
				instances_count: 0,
				disabled: true,
			},
		},
	],
};

const createApiReply = (status, replyDocument) => {
	const serializedReply = JSON.stringify(replyDocument);
	const headers = { "content-type": "application/vnd.api+json" };
	return new Response(serializedReply, { status, headers });
};

const createUnauthorizedReply = () =>
	createApiReply(401, {
		errors: [
			{
				status: "401",
				code: "unauthenticated",
				title: "Unauthenticated",
				detail: "Invalid API key",
			},
		],
	});

const createNotFoundReply = (title) =>
	createApiReply(404, {
		errors: [{ status: "404", code: "not_found", title }],
	});

const createUserReply = () =>
	createApiReply(200, {
		data: {
			type: "users",
			id: "9",
			attributes: { name: "Dev", email: "dev@example.com" },
		},
		meta: { test_mode: true },
	});

const isResourceMatchingFilter = (resource, filter) => {
	const { attributeName, expectedTerm } = filter;

	const isFilterAbsent = expectedTerm == null;
	const attributeValue = resource.attributes[attributeName];
	const isAttributeEqual = String(attributeValue) === expectedTerm;
	return isFilterAbsent || isAttributeEqual;
};

const createListReply = (resources, url) => {
	const storeFilter = {
		attributeName: "store_id",
		expectedTerm: url.searchParams.get("filter[store_id]"),
	};
	const productFilter = {
		attributeName: "product_id",
		expectedTerm: url.searchParams.get("filter[product_id]"),
	};

	const matchingResources = resources.filter(
		(resource) =>
			isResourceMatchingFilter(resource, storeFilter) &&
			isResourceMatchingFilter(resource, productFilter),
	);
	return createApiReply(200, {
		data: matchingResources,
		meta: { page: { currentPage: 1, lastPage: 1 } },
	});
};

const readApiKeyFromRequest = (requestInit) => {
	const headers = new Headers(requestInit?.headers);
	const authorization = headers.get("authorization") ?? "";
	return authorization.replace("Bearer ", "");
};

globalThis.fetch = async (requestTarget, requestInit) => {
	const isRequestUrlString = typeof requestTarget === "string";
	const requestUrl = isRequestUrlString ? requestTarget : requestTarget.url;
	const url = new URL(requestUrl);
	const apiKey = readApiKeyFromRequest(requestInit);

	const isEveryCallRejected = apiKey === "rejected-key";
	if (isEveryCallRejected) return createUnauthorizedReply();

	const isIdentityCall =
		url.pathname === USERS_ME_PATH || url.pathname === "/v1/stores";
	const isRevokedAfterConnect =
		apiKey === "revoked-after-connect" && !isIdentityCall;
	if (isRevokedAfterConnect) return createUnauthorizedReply();

	const isUserCall = url.pathname === USERS_ME_PATH;
	if (isUserCall) return createUserReply();

	const pathMatch = url.pathname.match(/^\/v1\/([a-z-]+)(?:\/(\d+))?$/);
	const resources = pathMatch && tablesByResourceType[pathMatch[1]];
	const isResourceTypeUnknown = resources == null;
	if (isResourceTypeUnknown) return createNotFoundReply(url.pathname);

	const resourceId = pathMatch[2];
	const isListCall = resourceId == null;
	if (isListCall) return createListReply(resources, url);

	const foundResource = resources.find(
		(resource) => resource.id === resourceId,
	);
	const isResourceMissing = foundResource == null;
	if (isResourceMissing) {
		return createNotFoundReply(`${pathMatch[1]} ${resourceId}`);
	}

	return createApiReply(200, { data: foundResource });
};
