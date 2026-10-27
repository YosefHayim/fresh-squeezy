const RECOMMENDED_EVENTS = [
	"order_created",
	"order_refunded",
	"subscription_created",
	"subscription_updated",
	"subscription_cancelled",
	"subscription_resumed",
	"subscription_expired",
	"subscription_payment_success",
	"subscription_payment_failed",
];

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

const TABLES = {
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
				events: RECOMMENDED_EVENTS,
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

const sendApiReply = (status, replyDocument) => {
	const replyString = JSON.stringify(replyDocument);
	const headers = { "content-type": "application/vnd.api+json" };
	return new Response(replyString, { status, headers });
};

const createUnauthorizedReply = () =>
	sendApiReply(401, {
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
	sendApiReply(404, {
		errors: [{ status: "404", code: "not_found", title }],
	});

const createUserReply = () =>
	sendApiReply(200, {
		data: {
			type: "users",
			id: "9",
			attributes: { name: "Dev", email: "dev@example.com" },
		},
		meta: { test_mode: true },
	});

const matchesFilter = (resource, filter) => {
	const { attributeName, expectedTerm } = filter;
	const isFilterAbsent = !expectedTerm;
	return (
		isFilterAbsent ||
		String(resource.attributes[attributeName]) === expectedTerm
	);
};

const createListReply = (table, url) => {
	const storeFilter = {
		attributeName: "store_id",
		expectedTerm: url.searchParams.get("filter[store_id]"),
	};
	const productFilter = {
		attributeName: "product_id",
		expectedTerm: url.searchParams.get("filter[product_id]"),
	};
	const matchingResources = table.filter(
		(resource) =>
			matchesFilter(resource, storeFilter) &&
			matchesFilter(resource, productFilter),
	);
	return sendApiReply(200, {
		data: matchingResources,
		meta: { page: { currentPage: 1, lastPage: 1 } },
	});
};

const createScenario = (requestInit) => {
	const headers = new Headers(requestInit?.headers);
	const authorization = headers.get("authorization") ?? "";
	return authorization.replace("Bearer ", "");
};

globalThis.fetch = async (requestTarget, requestInit) => {
	const isRequestUrlString = typeof requestTarget === "string";
	const requestUrl = isRequestUrlString ? requestTarget : requestTarget.url;
	const url = new URL(requestUrl);
	const scenario = createScenario(requestInit);
	const isEveryCallRejected = scenario === "rejected-key";
	if (isEveryCallRejected) return createUnauthorizedReply();
	const isIdentityCall =
		url.pathname === "/v1/users/me" || url.pathname === "/v1/stores";
	const isRevokedAfterConnect =
		scenario === "revoked-after-connect" && !isIdentityCall;
	if (isRevokedAfterConnect) return createUnauthorizedReply();

	const isUserCall = url.pathname === "/v1/users/me";
	if (isUserCall) return createUserReply();
	const pathParts = url.pathname.match(/^\/v1\/([a-z-]+)(?:\/(\d+))?$/);
	const table = pathParts && TABLES[pathParts[1]];
	const isTableMissing = !table;
	if (isTableMissing) return createNotFoundReply(url.pathname);
	const id = pathParts[2];
	const isListCall = id === undefined;
	if (isListCall) return createListReply(table, url);
	const found = table.find((resource) => resource.id === id);
	const isResourceMissing = found === undefined;
	if (isResourceMissing) return createNotFoundReply(`${pathParts[1]} ${id}`);
	return sendApiReply(200, { data: found });
};
