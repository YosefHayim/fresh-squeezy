import { expect, test } from "vitest";
import {
	discoverObjectPages,
	extractResourceExample,
	renderTypes,
} from "./generate-api-types.mjs";

test("generate-api-types discovers unique Lemon Squeezy object pages from the docs nav", () => {
	const pages = discoverObjectPages(`
      <a href="/api/orders/the-order-object">Order</a>
      <a href="/api/orders/the-order-object">Order duplicate</a>
      <a href="https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object">Invoice</a>
      <a href="/api/orders/list-all-orders">List orders</a>
    `);

	expect(pages).toEqual([
		{
			resourceType: "orders",
			resourceName: "order",
			interfaceName: "GeneratedOrderAttributes",
			url: "https://docs.lemonsqueezy.com/api/orders/the-order-object",
		},
		{
			resourceType: "subscription-invoices",
			resourceName: "subscriptionInvoice",
			interfaceName: "GeneratedSubscriptionInvoiceAttributes",
			url: "https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object",
		},
	]);
});

test("generate-api-types extracts a resource JSON example from syntax-highlighted docs HTML", () => {
	const html = `<code data-language="json">
      <span>{</span>
      <span>&quot;type&quot;: &quot;checkouts&quot;,</span>
      <span>&quot;attributes&quot;: {</span>
      <span>&quot;url&quot;: &quot;https://example.test&quot;,</span>
      <span>&quot;checkout_options&quot;: { &quot;skip_trial&quot;: true }</span>
      <span>}</span>
      <span>}</span>
      <span>}</span>
    </code>`;

	expect(extractResourceExample(html, "checkouts")).toEqual({
		type: "checkouts",
		attributes: {
			url: "https://example.test",
			checkout_options: { skip_trial: true },
		},
	});
});

const resourceNamesByType = [
	["users", "user"],
	["stores", "store"],
	["customers", "customer"],
	["products", "product"],
	["variants", "variant"],
	["prices", "price"],
	["files", "file"],
	["orders", "order"],
	["order-items", "orderItem"],
	["subscriptions", "subscription"],
	["subscription-invoices", "subscriptionInvoice"],
	["subscription-items", "subscriptionItem"],
	["usage-records", "usageRecord"],
	["discounts", "discount"],
	["discount-redemptions", "discountRedemption"],
	["license-keys", "licenseKey"],
	["license-key-instances", "licenseKeyInstance"],
	["checkouts", "checkout"],
	["webhooks", "webhook"],
	["affiliates", "affiliate"],
] as const;

test.each(resourceNamesByType)(
	"generate-api-types names %s as %s",
	(resourceType, resourceName) => {
		const singularType = resourceType.replace(/s$/, "");
		const nav = `<a href="/api/${resourceType}/the-${singularType}-object">x</a>`;
		const [page] = discoverObjectPages(nav);
		expect(page.resourceName).toBe(resourceName);
	},
);

test("generate-api-types returns null when a JSON block cannot be parsed even after trimming braces", () => {
	const html =
		'<code data-language="json">{ "type": "checkouts", "attributes": { }</code>';
	expect(extractResourceExample(html, "checkouts")).toBeNull();
});

test("generate-api-types types null attributes by their key name", () => {
	const attributes = {
		created_at: null,
		renews_at: null,
		billing_date: null,
		user_email: null,
		unit_price_decimal: null,
		store_id: null,
		is_paused: null,
		mystery: null,
	};
	const types = renderTypes([
		{
			resourceType: "orders",
			resourceName: "order",
			interfaceName: "GeneratedOrderAttributes",
			url: "https://docs.lemonsqueezy.com/api/orders/the-order-object",
			attributes,
		},
	]);
	expect(types).toContain("created_at?: string | null;");
	expect(types).toContain("renews_at?: string | null;");
	expect(types).toContain("billing_date?: string | null;");
	expect(types).toContain("user_email?: string | null;");
	expect(types).toContain("unit_price_decimal?: string | number | null;");
	expect(types).toContain("store_id?: number | null;");
	expect(types).toContain("is_paused?: boolean | null;");
	expect(types).toContain("mystery?: unknown | null;");
});
