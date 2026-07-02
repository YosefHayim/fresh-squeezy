import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../core/http.js";
import { getAffiliate, listAffiliatesForStore } from "./affiliates.js";
import { getCheckout, listCheckoutsForStore } from "./checkouts.js";
import { getCustomer, listCustomersForStore } from "./customers.js";
import {
  getDiscountRedemption,
  listDiscountRedemptionsForDiscount,
} from "./discountRedemptions.js";
import { getFile, listFilesForVariant } from "./files.js";
import {
  getLicenseKeyInstance,
  listLicenseKeyInstancesForLicenseKey,
} from "./licenseKeyInstances.js";
import { getOrderItem, listOrderItemsForOrder } from "./orderItems.js";
import { getOrder } from "./orders.js";
import { getPrice } from "./prices.js";
import {
  getSubscriptionInvoice,
  listSubscriptionInvoicesForSubscription,
} from "./subscriptionInvoices.js";
import {
  buildSubscriptionItemUpdateBody,
  getSubscriptionItem,
  listSubscriptionItemsForSubscription,
} from "./subscriptionItems.js";
import { getSubscription } from "./subscriptions.js";
import { getUsageRecord, listUsageRecordsForSubscriptionItem } from "./usageRecords.js";

function fakeHttp() {
  const resource = { type: "resource", id: "42", attributes: {} };
  const getResource = vi.fn(async () => resource);
  const paginate = vi.fn(async () => [resource]);

  return {
    getResource,
    paginate,
    http: { getResource, paginate } as unknown as HttpClient,
  };
}

describe("resource helper wrappers", () => {
  const getCases: Array<
    [string, (http: HttpClient, id: string | number) => Promise<unknown>, string]
  > = [
    ["affiliate", getAffiliate, "/v1/affiliates/42"],
    ["checkout", getCheckout, "/v1/checkouts/42"],
    ["customer", getCustomer, "/v1/customers/42"],
    ["discount redemption", getDiscountRedemption, "/v1/discount-redemptions/42"],
    ["file", getFile, "/v1/files/42"],
    ["license key instance", getLicenseKeyInstance, "/v1/license-key-instances/42"],
    ["order", getOrder, "/v1/orders/42"],
    ["order item", getOrderItem, "/v1/order-items/42"],
    ["price", getPrice, "/v1/prices/42"],
    ["subscription", getSubscription, "/v1/subscriptions/42"],
    ["subscription invoice", getSubscriptionInvoice, "/v1/subscription-invoices/42"],
    ["subscription item", getSubscriptionItem, "/v1/subscription-items/42"],
    ["usage record", getUsageRecord, "/v1/usage-records/42"],
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
    [
      "discount redemptions",
      listDiscountRedemptionsForDiscount,
      "/v1/discount-redemptions",
      { "filter[discount_id]": "42" },
    ],
    ["files", listFilesForVariant, "/v1/files", { "filter[variant_id]": "42" }],
    [
      "license key instances",
      listLicenseKeyInstancesForLicenseKey,
      "/v1/license-key-instances",
      { "filter[license_key_id]": "42" },
    ],
    ["order items", listOrderItemsForOrder, "/v1/order-items", { "filter[order_id]": "42" }],
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
    [
      "usage records",
      listUsageRecordsForSubscriptionItem,
      "/v1/usage-records",
      { "filter[subscription_item_id]": "42" },
    ],
  ];

  for (const [name, helper, path, query] of listCases) {
    it(`lists ${name} through pagination`, async () => {
      const { http, paginate } = fakeHttp();

      await helper(http, 42);

      expect(paginate).toHaveBeenCalledWith(path, query);
    });
  }

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
});
