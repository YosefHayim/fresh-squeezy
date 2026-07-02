import { describe, expect, it } from "vitest";
import { discoverObjectPages, extractResourceExample } from "./generate-api-types.mjs";

describe("generate-api-types", () => {
  it("discovers unique Lemon Squeezy object pages from the docs nav", () => {
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

  it("extracts a resource JSON example from syntax-highlighted docs HTML", () => {
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
});
