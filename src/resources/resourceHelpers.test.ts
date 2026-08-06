import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../core/http.js";
import { getAffiliate, listAffiliatesForStore } from "./affiliates.js";
import { createCheckout, getCheckout, listCheckoutsForStore } from "./checkouts.js";
import { createCustomer, getCustomer, listCustomersForStore, updateCustomer } from "./customers.js";
import {
  getDiscountRedemption,
  listDiscountRedemptionsForDiscount,
} from "./discountRedemptions.js";
import { createDiscount, deleteDiscount, getDiscount, listDiscountsForStore } from "./discounts.js";
import { getFile, listFilesForVariant } from "./files.js";
import {
  getLicenseKeyInstance,
  listLicenseKeyInstancesForLicenseKey,
} from "./licenseKeyInstances.js";
import { getLicenseKey, listLicenseKeysForStore, updateLicenseKey } from "./licenseKeys.js";
import { getOrderItem, listOrderItemsForOrder } from "./orderItems.js";
import { generateOrderInvoice, getOrder, listOrdersForStore, refundOrder } from "./orders.js";
import { getPrice, listPricesForVariant } from "./prices.js";
import { getProduct, listProducts } from "./products.js";
import { getStore, listStores } from "./stores.js";
import {
  generateSubscriptionInvoice,
  getSubscriptionInvoice,
  listSubscriptionInvoicesForSubscription,
  refundSubscriptionInvoice,
} from "./subscriptionInvoices.js";
import {
  buildSubscriptionItemUpdateBody,
  getSubscriptionItem,
  getSubscriptionItemCurrentUsage,
  listSubscriptionItemsForSubscription,
  updateSubscriptionItem,
} from "./subscriptionItems.js";
import {
  cancelSubscription,
  getSubscription,
  listSubscriptionsForStore,
  updateSubscription,
} from "./subscriptions.js";
import {
  createUsageRecord,
  getUsageRecord,
  listUsageRecordsForSubscriptionItem,
} from "./usageRecords.js";
import { getAuthenticatedUser } from "./users.js";
import { getVariant, listVariantsForProduct } from "./variants.js";
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  listWebhooksForStore,
  updateWebhook,
} from "./webhooks.js";

const fakeHttp = () => {
  const resource = { type: "resource", id: "42", attributes: {} };
  const getResource = vi.fn(async () => resource);
  const postResource = vi.fn(async () => resource);
  const patchResource = vi.fn(async () => resource);
  const deleteResource = vi.fn(async () => undefined);
  const paginate = vi.fn(async () => [resource]);
  const request = vi.fn(async () => ({ data: resource, meta: { test_mode: true } }));

  return {
    getResource,
    postResource,
    patchResource,
    deleteResource,
    paginate,
    request,
    http: {
      getResource,
      postResource,
      patchResource,
      deleteResource,
      paginate,
      request,
    } as unknown as HttpClient,
  };
};

describe("resource helper wrappers", () => {
  const getCases: Array<
    [string, (http: HttpClient, id: string | number) => Promise<unknown>, string]
  > = [
    ["affiliate", getAffiliate, "/v1/affiliates/42"],
    ["checkout", getCheckout, "/v1/checkouts/42"],
    ["customer", getCustomer, "/v1/customers/42"],
    ["discount", getDiscount, "/v1/discounts/42"],
    ["discount redemption", getDiscountRedemption, "/v1/discount-redemptions/42"],
    ["file", getFile, "/v1/files/42"],
    ["license key", getLicenseKey, "/v1/license-keys/42"],
    ["license key instance", getLicenseKeyInstance, "/v1/license-key-instances/42"],
    ["order", getOrder, "/v1/orders/42"],
    ["order item", getOrderItem, "/v1/order-items/42"],
    ["price", getPrice, "/v1/prices/42"],
    ["product", getProduct, "/v1/products/42"],
    ["store", getStore, "/v1/stores/42"],
    ["subscription", getSubscription, "/v1/subscriptions/42"],
    ["subscription invoice", getSubscriptionInvoice, "/v1/subscription-invoices/42"],
    ["subscription item", getSubscriptionItem, "/v1/subscription-items/42"],
    ["usage record", getUsageRecord, "/v1/usage-records/42"],
    ["variant", getVariant, "/v1/variants/42"],
    ["webhook", getWebhook, "/v1/webhooks/42"],
  ];

  for (const [name, helper, path] of getCases) {
    it(`fetches a ${name} resource by ID`, async () => {
      const { getResource, http } = fakeHttp();

      await helper(http, 42);

      expect(getResource).toHaveBeenCalledWith(path);
    });
  }

  const listCases: Array<
    [
      string,
      (http: HttpClient, id: string | number) => Promise<unknown>,
      string,
      Record<string, string>,
    ]
  > = [
    ["affiliates", listAffiliatesForStore, "/v1/affiliates", { "filter[store_id]": "42" }],
    ["checkouts", listCheckoutsForStore, "/v1/checkouts", { "filter[store_id]": "42" }],
    ["customers", listCustomersForStore, "/v1/customers", { "filter[store_id]": "42" }],
    ["discounts", listDiscountsForStore, "/v1/discounts", { "filter[store_id]": "42" }],
    [
      "discount redemptions",
      listDiscountRedemptionsForDiscount,
      "/v1/discount-redemptions",
      { "filter[discount_id]": "42" },
    ],
    ["files", listFilesForVariant, "/v1/files", { "filter[variant_id]": "42" }],
    ["license keys", listLicenseKeysForStore, "/v1/license-keys", { "filter[store_id]": "42" }],
    [
      "license key instances",
      listLicenseKeyInstancesForLicenseKey,
      "/v1/license-key-instances",
      { "filter[license_key_id]": "42" },
    ],
    ["orders", listOrdersForStore, "/v1/orders", { "filter[store_id]": "42" }],
    ["order items", listOrderItemsForOrder, "/v1/order-items", { "filter[order_id]": "42" }],
    ["prices", listPricesForVariant, "/v1/prices", { "filter[variant_id]": "42" }],
    ["products", listProducts, "/v1/products", { "filter[store_id]": "42" }],
    [
      "subscription invoices",
      listSubscriptionInvoicesForSubscription,
      "/v1/subscription-invoices",
      { "filter[subscription_id]": "42" },
    ],
    [
      "subscription items",
      listSubscriptionItemsForSubscription,
      "/v1/subscription-items",
      { "filter[subscription_id]": "42" },
    ],
    ["subscriptions", listSubscriptionsForStore, "/v1/subscriptions", { "filter[store_id]": "42" }],
    [
      "usage records",
      listUsageRecordsForSubscriptionItem,
      "/v1/usage-records",
      { "filter[subscription_item_id]": "42" },
    ],
    ["variants", listVariantsForProduct, "/v1/variants", { "filter[product_id]": "42" }],
    ["webhooks", listWebhooksForStore, "/v1/webhooks", { "filter[store_id]": "42" }],
  ];

  for (const [name, helper, path, query] of listCases) {
    it(`lists ${name} through pagination`, async () => {
      const { http, paginate } = fakeHttp();

      await helper(http, 42);

      expect(paginate).toHaveBeenCalledWith(path, query);
    });
  }

  it("lists stores without a filter", async () => {
    const { http, paginate } = fakeHttp();
    await listStores(http);
    expect(paginate).toHaveBeenCalledWith("/v1/stores");
  });

  it("fetches the authenticated user document with meta", async () => {
    const { http, request } = fakeHttp();
    const doc = await getAuthenticatedUser(http);
    expect(request).toHaveBeenCalledWith({ path: "/v1/users/me" });
    expect(doc.meta).toEqual({ test_mode: true });
  });

  it("builds subscription item update request bodies", () => {
    expect(
      buildSubscriptionItemUpdateBody(42, {
        quantity: 3,
        invoice_immediately: true,
        disable_prorations: true,
      }),
    ).toEqual({
      data: {
        type: "subscription-items",
        id: "42",
        attributes: {
          quantity: 3,
          invoice_immediately: true,
          disable_prorations: true,
        },
      },
    });
  });

  it("posts create helpers to collection paths", async () => {
    const { http, postResource } = fakeHttp();
    const body = { data: { type: "webhooks" } };

    await createWebhook(http, body);
    expect(postResource).toHaveBeenCalledWith("/v1/webhooks", body);

    await createCustomer(http, body);
    expect(postResource).toHaveBeenCalledWith("/v1/customers", body);

    await createDiscount(http, body);
    expect(postResource).toHaveBeenCalledWith("/v1/discounts", body);

    await createCheckout(http, body);
    expect(postResource).toHaveBeenCalledWith("/v1/checkouts", body);

    await createUsageRecord(http, body);
    expect(postResource).toHaveBeenCalledWith("/v1/usage-records", body);
  });

  it("patches update helpers on resource paths", async () => {
    const { http, patchResource } = fakeHttp();
    const body = { data: { type: "x", id: "42", attributes: {} } };

    await updateWebhook(http, 42, body);
    expect(patchResource).toHaveBeenCalledWith("/v1/webhooks/42", body);

    await updateCustomer(http, 42, body);
    expect(patchResource).toHaveBeenCalledWith("/v1/customers/42", body);

    await updateSubscription(http, 42, body);
    expect(patchResource).toHaveBeenCalledWith("/v1/subscriptions/42", body);

    await updateLicenseKey(http, 42, body);
    expect(patchResource).toHaveBeenCalledWith("/v1/license-keys/42", body);

    await updateSubscriptionItem(http, 42, body);
    expect(patchResource).toHaveBeenCalledWith("/v1/subscription-items/42", body);
  });

  it("deletes and cancels through the documented HTTP verbs", async () => {
    const { http, deleteResource, request } = fakeHttp();

    await deleteWebhook(http, 42);
    expect(deleteResource).toHaveBeenCalledWith("/v1/webhooks/42");

    await deleteDiscount(http, 42);
    expect(deleteResource).toHaveBeenCalledWith("/v1/discounts/42");

    await cancelSubscription(http, 42);
    expect(request).toHaveBeenCalledWith({
      method: "DELETE",
      path: "/v1/subscriptions/42",
    });
  });

  it("posts refunds and invoice generation with optional bodies", async () => {
    const { http, postResource, request } = fakeHttp();

    await refundOrder(http, 42);
    expect(postResource).toHaveBeenCalledWith("/v1/orders/42/refund", {});

    await refundOrder(http, 42, { data: { attributes: { amount: 100 } } });
    expect(postResource).toHaveBeenCalledWith("/v1/orders/42/refund", {
      data: { attributes: { amount: 100 } },
    });

    await refundSubscriptionInvoice(http, 42);
    expect(postResource).toHaveBeenCalledWith("/v1/subscription-invoices/42/refund", {});

    await generateOrderInvoice(http, 42);
    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/v1/orders/42/generate-invoice",
      body: {},
    });

    await generateSubscriptionInvoice(http, 42, { locale: "en" });
    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/v1/subscription-invoices/42/generate-invoice",
      body: { locale: "en" },
    });

    await getSubscriptionItemCurrentUsage(http, 42);
    expect(request).toHaveBeenCalledWith({
      path: "/v1/subscription-items/42/current-usage",
    });
  });
});
