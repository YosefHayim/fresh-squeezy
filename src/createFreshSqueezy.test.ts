import { describe, expect, it } from "vitest";
import { type FreshSqueezyClient, createFreshSqueezy } from "./createFreshSqueezy.js";

const clientWithLog = (): { lemon: FreshSqueezyClient; calls: string[] } => {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${decodeURIComponent(url.search)}`);
    const body = { data: [], meta: { page: { currentPage: 1, lastPage: 1 } } };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { lemon: createFreshSqueezy({ apiKey: "k", fetch }), calls };
};

const BODY = { data: { type: "x" } };

describe("createFreshSqueezy nested ops", () => {
  it.each<[string, (lemon: FreshSqueezyClient) => Promise<unknown>, string]>([
    ["users.me", (l) => l.users.me(), "GET /v1/users/me"],
    ["stores.get", (l) => l.stores.get(1), "GET /v1/stores/1"],
    ["stores.list", (l) => l.stores.list(), "GET /v1/stores?page[number]=1"],
    ["products.get", (l) => l.products.get(1), "GET /v1/products/1"],
    [
      "products.list",
      (l) => l.products.list(2),
      "GET /v1/products?filter[store_id]=2&page[number]=1",
    ],
    ["variants.get", (l) => l.variants.get(1), "GET /v1/variants/1"],
    [
      "variants.list",
      (l) => l.variants.list(3),
      "GET /v1/variants?filter[product_id]=3&page[number]=1",
    ],
    ["prices.get", (l) => l.prices.get(1), "GET /v1/prices/1"],
    ["prices.list", (l) => l.prices.list(3), "GET /v1/prices?filter[variant_id]=3&page[number]=1"],
    ["files.get", (l) => l.files.get(1), "GET /v1/files/1"],
    ["files.list", (l) => l.files.list(3), "GET /v1/files?filter[variant_id]=3&page[number]=1"],
    ["customers.get", (l) => l.customers.get(1), "GET /v1/customers/1"],
    [
      "customers.list",
      (l) => l.customers.list(2),
      "GET /v1/customers?filter[store_id]=2&page[number]=1",
    ],
    ["customers.create", (l) => l.customers.create(BODY), "POST /v1/customers"],
    ["customers.update", (l) => l.customers.update(1, BODY), "PATCH /v1/customers/1"],
    ["orders.get", (l) => l.orders.get(1), "GET /v1/orders/1"],
    ["orders.list", (l) => l.orders.list(2), "GET /v1/orders?filter[store_id]=2&page[number]=1"],
    ["orders.refund", (l) => l.orders.refund(1), "POST /v1/orders/1/refund"],
    [
      "orders.generateInvoice",
      (l) => l.orders.generateInvoice(1),
      "POST /v1/orders/1/generate-invoice",
    ],
    ["orderItems.get", (l) => l.orderItems.get(1), "GET /v1/order-items/1"],
    [
      "orderItems.list",
      (l) => l.orderItems.list(3),
      "GET /v1/order-items?filter[order_id]=3&page[number]=1",
    ],
    ["subscriptions.get", (l) => l.subscriptions.get(1), "GET /v1/subscriptions/1"],
    [
      "subscriptions.list",
      (l) => l.subscriptions.list(2),
      "GET /v1/subscriptions?filter[store_id]=2&page[number]=1",
    ],
    ["subscriptions.update", (l) => l.subscriptions.update(1, BODY), "PATCH /v1/subscriptions/1"],
    ["subscriptions.cancel", (l) => l.subscriptions.cancel(1), "DELETE /v1/subscriptions/1"],
    ["subscriptionItems.get", (l) => l.subscriptionItems.get(1), "GET /v1/subscription-items/1"],
    [
      "subscriptionItems.list",
      (l) => l.subscriptionItems.list(3),
      "GET /v1/subscription-items?filter[subscription_id]=3&page[number]=1",
    ],
    [
      "subscriptionItems.update",
      (l) => l.subscriptionItems.update(1, BODY),
      "PATCH /v1/subscription-items/1",
    ],
    [
      "subscriptionItems.currentUsage",
      (l) => l.subscriptionItems.currentUsage(1),
      "GET /v1/subscription-items/1/current-usage",
    ],
    [
      "subscriptionInvoices.get",
      (l) => l.subscriptionInvoices.get(1),
      "GET /v1/subscription-invoices/1",
    ],
    [
      "subscriptionInvoices.list",
      (l) => l.subscriptionInvoices.list(3),
      "GET /v1/subscription-invoices?filter[subscription_id]=3&page[number]=1",
    ],
    [
      "subscriptionInvoices.refund",
      (l) => l.subscriptionInvoices.refund(1),
      "POST /v1/subscription-invoices/1/refund",
    ],
    [
      "subscriptionInvoices.generateInvoice",
      (l) => l.subscriptionInvoices.generateInvoice(1),
      "POST /v1/subscription-invoices/1/generate-invoice",
    ],
    ["usageRecords.get", (l) => l.usageRecords.get(1), "GET /v1/usage-records/1"],
    [
      "usageRecords.list",
      (l) => l.usageRecords.list(3),
      "GET /v1/usage-records?filter[subscription_item_id]=3&page[number]=1",
    ],
    ["usageRecords.create", (l) => l.usageRecords.create(BODY), "POST /v1/usage-records"],
    ["discounts.get", (l) => l.discounts.get(1), "GET /v1/discounts/1"],
    [
      "discounts.list",
      (l) => l.discounts.list(2),
      "GET /v1/discounts?filter[store_id]=2&page[number]=1",
    ],
    ["discounts.create", (l) => l.discounts.create(BODY), "POST /v1/discounts"],
    ["discounts.delete", (l) => l.discounts.delete(1), "DELETE /v1/discounts/1"],
    [
      "discountRedemptions.get",
      (l) => l.discountRedemptions.get(1),
      "GET /v1/discount-redemptions/1",
    ],
    [
      "discountRedemptions.list",
      (l) => l.discountRedemptions.list(3),
      "GET /v1/discount-redemptions?filter[discount_id]=3&page[number]=1",
    ],
    ["licenseKeys.get", (l) => l.licenseKeys.get(1), "GET /v1/license-keys/1"],
    [
      "licenseKeys.list",
      (l) => l.licenseKeys.list(2),
      "GET /v1/license-keys?filter[store_id]=2&page[number]=1",
    ],
    ["licenseKeys.update", (l) => l.licenseKeys.update(1, BODY), "PATCH /v1/license-keys/1"],
    [
      "licenseKeyInstances.get",
      (l) => l.licenseKeyInstances.get(1),
      "GET /v1/license-key-instances/1",
    ],
    [
      "licenseKeyInstances.list",
      (l) => l.licenseKeyInstances.list(3),
      "GET /v1/license-key-instances?filter[license_key_id]=3&page[number]=1",
    ],
    ["checkouts.get", (l) => l.checkouts.get(1), "GET /v1/checkouts/1"],
    [
      "checkouts.list",
      (l) => l.checkouts.list(2),
      "GET /v1/checkouts?filter[store_id]=2&page[number]=1",
    ],
    ["checkouts.create", (l) => l.checkouts.create(BODY), "POST /v1/checkouts"],
    ["webhooks.get", (l) => l.webhooks.get(1), "GET /v1/webhooks/1"],
    [
      "webhooks.list",
      (l) => l.webhooks.list(2),
      "GET /v1/webhooks?filter[store_id]=2&page[number]=1",
    ],
    ["webhooks.create", (l) => l.webhooks.create(BODY), "POST /v1/webhooks"],
    ["webhooks.update", (l) => l.webhooks.update(1, BODY), "PATCH /v1/webhooks/1"],
    ["webhooks.delete", (l) => l.webhooks.delete(1), "DELETE /v1/webhooks/1"],
    ["affiliates.get", (l) => l.affiliates.get(1), "GET /v1/affiliates/1"],
    [
      "affiliates.list",
      (l) => l.affiliates.list(2),
      "GET /v1/affiliates?filter[store_id]=2&page[number]=1",
    ],
  ])("%s → %s", async (_name, call, expected) => {
    const { lemon, calls } = clientWithLog();
    await call(lemon);
    expect(calls).toEqual([expected]);
  });
});
