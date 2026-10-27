import { createMockFetch, type MockRoute } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { readConfig } from "@/client/config.js";
import { createHttp } from "@/client/http.js";
import type {
	CreateInput,
	ListableResource,
	ResourceType,
	UpdateInput,
} from "@/client/lemon-squeezy-types.js";
import { createLemonSqueezyClient } from "./lemon-squeezy-client.js";

const ANY_RESOURCE_BODY = { data: { type: "any", id: "1", attributes: {} } };

const ANY_ROUTE: MockRoute = {
	match: () => true,
	status: 200,
	body: ANY_RESOURCE_BODY,
};

const ALL_RESOURCES: ResourceType[] = [
	"users",
	"stores",
	"customers",
	"products",
	"variants",
	"prices",
	"files",
	"orders",
	"order-items",
	"subscriptions",
	"subscription-invoices",
	"subscription-items",
	"usage-records",
	"discounts",
	"discount-redemptions",
	"license-keys",
	"license-key-instances",
	"checkouts",
	"webhooks",
	"affiliates",
];

const LISTABLE_RESOURCES = ALL_RESOURCES.filter(
	(type): type is ListableResource => type !== "users",
);

const CREATE_CASES = [
	{
		type: "customers",
		input: {
			attributes: { name: "Ada", email: "ada@example.com", country: "GB" },
			relationships: { store: "1" },
		} satisfies CreateInput["customers"],
		expectedRelationships: { store: { data: { type: "stores", id: "1" } } },
	},
	{
		type: "usage-records",
		input: {
			attributes: { quantity: 5, action: "set" },
			relationships: { "subscription-item": "7" },
		} satisfies CreateInput["usage-records"],
		expectedRelationships: {
			"subscription-item": { data: { type: "subscription-items", id: "7" } },
		},
	},
	{
		type: "discounts",
		input: {
			attributes: {
				name: "10% Off",
				code: "10PERCENT",
				amount: 10,
				amount_type: "percent",
				is_limited_to_products: true,
			},
			relationships: { store: "1", variants: ["3", "4"] },
		} satisfies CreateInput["discounts"],
		expectedRelationships: {
			store: { data: { type: "stores", id: "1" } },
			variants: {
				data: [
					{ type: "variants", id: "3" },
					{ type: "variants", id: "4" },
				],
			},
		},
	},
	{
		type: "checkouts",
		input: {
			attributes: { custom_price: 500, preview: true },
			relationships: { store: "1", variant: "2" },
		} satisfies CreateInput["checkouts"],
		expectedRelationships: {
			store: { data: { type: "stores", id: "1" } },
			variant: { data: { type: "variants", id: "2" } },
		},
	},
	{
		type: "webhooks",
		input: {
			attributes: {
				url: "https://example.com/hook",
				events: ["order_created"],
				secret: "signing-secret",
			},
			relationships: { store: "1" },
		} satisfies CreateInput["webhooks"],
		expectedRelationships: { store: { data: { type: "stores", id: "1" } } },
	},
] as const;

const UPDATE_CASES = [
	{
		type: "customers",
		attributes: { name: "Ada Lovelace", status: "archived" },
	},
	{
		type: "subscriptions",
		attributes: { pause: { mode: "void" }, invoice_immediately: true },
	},
	{ type: "subscription-items", attributes: { quantity: 10 } },
	{
		type: "license-keys",
		attributes: { activation_limit: null, disabled: false },
	},
	{ type: "webhooks", attributes: { events: ["order_created"] } },
] as const satisfies ReadonlyArray<{
	type: keyof UpdateInput;
	attributes: UpdateInput[keyof UpdateInput];
}>;

const REMOVABLE_RESOURCES = ["discounts", "webhooks"] as const;

const REFUNDABLE_RESOURCES = ["orders", "subscription-invoices"] as const;

const BILLING = {
	name: "John Doe",
	address: "123 Main St",
	city: "Anytown",
	state: "CA",
	zip_code: "12345",
	country: "US",
	notes: "Thank you",
};

const clientOf = (route: MockRoute = ANY_ROUTE) => {
	const { fetch, calls } = createMockFetch([route]);
	const config = readConfig({ apiKey: "k", fetch });
	const client = createLemonSqueezyClient(createHttp(config));
	const lastCall = () => {
		const [call] = calls.slice(-1);
		const url = new URL(call?.url ?? "");
		const body = call?.body ? JSON.parse(call.body) : undefined;
		return { method: call?.method, url, body };
	};
	return { client, calls, lastCall };
};

test.each(ALL_RESOURCES)("get reads /v1/%s/:id with GET", async (type) => {
	const { client, lastCall } = clientOf();

	const resource = await client.get(type, "9");

	const { method, url } = lastCall();
	expect(method).toBe("GET");
	expect(url.pathname).toBe(`/v1/${type}/9`);
	expect(resource.id).toBe("1");
});

test.each(LISTABLE_RESOURCES)(
	"list reads /v1/%s with page size 100",
	async (type) => {
		const { client, lastCall } = clientOf({
			...ANY_ROUTE,
			body: { data: [], meta: { page: { currentPage: 1, lastPage: 1 } } },
		});

		await client.list(type);

		const { method, url } = lastCall();
		expect(method).toBe("GET");
		expect(url.pathname).toBe(`/v1/${type}`);
		expect(url.searchParams.get("page[size]")).toBe("100");
	},
);

test("list sends every filter as filter[name]", async () => {
	const { client, lastCall } = clientOf({
		...ANY_ROUTE,
		body: { data: [] },
	});

	await client.list("orders", { store_id: 1, status: "paid" });

	const { url } = lastCall();
	expect(url.searchParams.get("filter[store_id]")).toBe("1");
	expect(url.searchParams.get("filter[status]")).toBe("paid");
});

test("list reads every page", async () => {
	const pageNumbersSeen: string[] = [];
	const pagedRoute: MockRoute = {
		match: ({ url }) => {
			pageNumbersSeen.push(new URL(url).searchParams.get("page[number]") ?? "");
			return true;
		},
		status: 200,
		body: {
			data: [{ type: "orders", id: "1", attributes: {} }],
			meta: { page: { currentPage: 1, lastPage: 2 } },
		},
	};
	const { client } = clientOf(pagedRoute);

	const orders = await client.list("orders");

	expect(pageNumbersSeen).toEqual(["1", "2"]);
	expect(orders).toHaveLength(2);
});

test.each(CREATE_CASES)(
	"create sends a JSON:API POST to /v1/$type",
	async ({ type, input, expectedRelationships }) => {
		const { client, lastCall } = clientOf();

		await client.create(type, input as never);

		const { method, url, body } = lastCall();
		expect(method).toBe("POST");
		expect(url.pathname).toBe(`/v1/${type}`);
		expect(body).toEqual({
			data: {
				type,
				attributes: input.attributes,
				relationships: expectedRelationships,
			},
		});
	},
);

test.each(UPDATE_CASES)(
	"update sends a JSON:API PATCH to /v1/$type/:id",
	async ({ type, attributes }) => {
		const { client, lastCall } = clientOf();

		await client.update(type, "5", attributes as never);

		const { method, url, body } = lastCall();
		expect(method).toBe("PATCH");
		expect(url.pathname).toBe(`/v1/${type}/5`);
		expect(body).toEqual({ data: { type, id: "5", attributes } });
	},
);

test.each(REMOVABLE_RESOURCES)(
	"remove sends DELETE to /v1/%s/:id",
	async (type) => {
		const { client, lastCall } = clientOf({
			...ANY_ROUTE,
			status: 204,
			body: undefined,
		});

		await client.remove(type, "9");

		const { method, url, body } = lastCall();
		expect(method).toBe("DELETE");
		expect(url.pathname).toBe(`/v1/${type}/9`);
		expect(body).toBeUndefined();
	},
);

test("cancelSubscription sends DELETE to /v1/subscriptions/:id", async () => {
	const { client, lastCall } = clientOf();

	await client.cancelSubscription("123");

	const { method, url } = lastCall();
	expect(method).toBe("DELETE");
	expect(url.pathname).toBe("/v1/subscriptions/123");
});

test.each(REFUNDABLE_RESOURCES)(
	"refund sends POST to /v1/%s/:id/refund with the amount",
	async (type) => {
		const { client, lastCall } = clientOf();

		await client.refund(type, "55", 500);

		const { method, url, body } = lastCall();
		expect(method).toBe("POST");
		expect(url.pathname).toBe(`/v1/${type}/55/refund`);
		expect(body).toEqual({
			data: { type, id: "55", attributes: { amount: 500 } },
		});
	},
);

test("refund without an amount sends no amount for a full refund", async () => {
	const { client, calls } = clientOf();

	await client.refund("orders", "55");

	const [call] = calls;
	const body = JSON.parse(call?.body ?? "{}");
	expect(body.data.attributes).toEqual({});
});

test.each(REFUNDABLE_RESOURCES)(
	"generateInvoice sends POST to /v1/%s/:id/generate-invoice with the billing query",
	async (type) => {
		const downloadUrl = "https://app.lemonsqueezy.com/invoice";
		const { client, lastCall } = clientOf({
			...ANY_ROUTE,
			body: { meta: { urls: { download_invoice: downloadUrl } } },
		});

		const invoice = await client.generateInvoice(type, "55", BILLING);

		const { method, url, body } = lastCall();
		expect(method).toBe("POST");
		expect(url.pathname).toBe(`/v1/${type}/55/generate-invoice`);
		expect(Object.fromEntries(url.searchParams)).toEqual(BILLING);
		expect(body).toBeUndefined();
		expect(invoice.meta.urls.download_invoice).toBe(downloadUrl);
	},
);

test("currentUsage reads /v1/subscription-items/:id/current-usage", async () => {
	const usageMeta = { quantity: 5, interval_unit: "month" };
	const { client, lastCall } = clientOf({
		...ANY_ROUTE,
		body: { meta: usageMeta },
	});

	const usage = await client.currentUsage("77");

	const { method, url } = lastCall();
	expect(method).toBe("GET");
	expect(url.pathname).toBe("/v1/subscription-items/77/current-usage");
	expect(usage.meta.quantity).toBe(5);
});

test("the resource name decides which calls compile", () => {
	const { client } = clientOf();
	const neverCalled = () => {
		// @ts-expect-error orders cannot be created
		client.create("orders", { attributes: {}, relationships: {} });
		// @ts-expect-error customers cannot be removed
		client.remove("customers", "1");
		// @ts-expect-error users cannot be listed
		client.list("users");
		// @ts-expect-error variants cannot be updated
		client.update("variants", "1", {});
		// @ts-expect-error customers cannot be refunded
		client.refund("customers", "1");
	};
	expect(neverCalled).toBeTypeOf("function");
});
