import { FreshSqueezyError } from "../core/errors.js";
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
import { type OpVerb, findResourceVerb } from "./registry.js";
import { getStore, listStores } from "./stores.js";
import {
  generateSubscriptionInvoice,
  getSubscriptionInvoice,
  listSubscriptionInvoicesForSubscription,
  refundSubscriptionInvoice,
} from "./subscriptionInvoices.js";
import {
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
import { getAuthenticatedUser, userResource } from "./users.js";
import { getVariant, listVariantsForProduct } from "./variants.js";
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  listWebhooksForStore,
  updateWebhook,
} from "./webhooks.js";

/**
 * Arguments for a single resource op invocation.
 *
 * One named input type — not a bag of unrelated returns.
 */
export interface InvokeOpArgs {
  id?: string | number;
  storeId?: string | number;
  parentId?: string | number;
  body?: unknown;
}

/**
 * Dispatch a docs-backed resource verb through the thin resource helpers.
 *
 * @param http - Shared API client.
 * @param resource - CLI resource token (`webhook`, `product`, …).
 * @param verb - Op verb (`get`, `create`, `refund`, …).
 * @param args - Ids / body for the call.
 * @returns A single JSON:API resource, list, void, or action payload.
 * @throws {FreshSqueezyError} When the verb is unknown or HTTP fails.
 *
 * @example
 * ```ts
 * const product = await invokeOp(http, "product", "get", { id: 42 });
 * ```
 */
export const invokeOp = async (
  http: HttpClient,
  resource: string,
  verb: OpVerb | string,
  args: InvokeOpArgs = {},
): Promise<unknown> => {
  const spec = findResourceVerb(resource, verb);
  if (!spec) {
    throw new FreshSqueezyError({
      code: "UNKNOWN_OP",
      message: `Unknown or unsupported op: ${verb} ${resource}. Run \`fresh-squeezy ops --list\`.`,
    });
  }

  const key = `${spec.resource}:${spec.verb}` as const;
  switch (key) {
    case "user:get":
      return userResource(await getAuthenticatedUser(http));

    case "store:get":
      return getStore(http, requireId(args, "store"));
    case "store:list":
      return listStores(http);

    case "product:get":
      return getProduct(http, requireId(args, "product"));
    case "product:list":
      return listProducts(http, requireStore(args));

    case "variant:get":
      return getVariant(http, requireId(args, "variant"));
    case "variant:list":
      return listVariantsForProduct(http, requireParent(args, "product"));

    case "price:get":
      return getPrice(http, requireId(args, "price"));
    case "price:list":
      return listPricesForVariant(http, requireParent(args, "variant"));

    case "file:get":
      return getFile(http, requireId(args, "file"));
    case "file:list":
      return listFilesForVariant(http, requireParent(args, "variant"));

    case "customer:get":
      return getCustomer(http, requireId(args, "customer"));
    case "customer:list":
      return listCustomersForStore(http, requireStore(args));
    case "customer:create":
      return createCustomer(http, requireBody(args));
    case "customer:update":
      return updateCustomer(http, requireId(args, "customer"), requireBody(args));

    case "order:get":
      return getOrder(http, requireId(args, "order"));
    case "order:list":
      return listOrdersForStore(http, requireStore(args));
    case "order:refund":
      return refundOrder(http, requireId(args, "order"), args.body);
    case "order:generate-invoice":
      return generateOrderInvoice(http, requireId(args, "order"), args.body);

    case "order-item:get":
      return getOrderItem(http, requireId(args, "order-item"));
    case "order-item:list":
      return listOrderItemsForOrder(http, requireParent(args, "order"));

    case "subscription:get":
      return getSubscription(http, requireId(args, "subscription"));
    case "subscription:list":
      return listSubscriptionsForStore(http, requireStore(args));
    case "subscription:update":
      return updateSubscription(http, requireId(args, "subscription"), requireBody(args));
    case "subscription:cancel":
      return cancelSubscription(http, requireId(args, "subscription"));

    case "subscription-item:get":
      return getSubscriptionItem(http, requireId(args, "subscription-item"));
    case "subscription-item:list":
      return listSubscriptionItemsForSubscription(http, requireParent(args, "subscription"));
    case "subscription-item:update":
      return updateSubscriptionItem(http, requireId(args, "subscription-item"), requireBody(args));
    case "subscription-item:current-usage":
      return getSubscriptionItemCurrentUsage(http, requireId(args, "subscription-item"));

    case "subscription-invoice:get":
      return getSubscriptionInvoice(http, requireId(args, "subscription-invoice"));
    case "subscription-invoice:list":
      return listSubscriptionInvoicesForSubscription(http, requireParent(args, "subscription"));
    case "subscription-invoice:refund":
      return refundSubscriptionInvoice(http, requireId(args, "subscription-invoice"), args.body);
    case "subscription-invoice:generate-invoice":
      return generateSubscriptionInvoice(http, requireId(args, "subscription-invoice"), args.body);

    case "usage-record:get":
      return getUsageRecord(http, requireId(args, "usage-record"));
    case "usage-record:list":
      return listUsageRecordsForSubscriptionItem(http, requireParent(args, "subscription-item"));
    case "usage-record:create":
      return createUsageRecord(http, requireBody(args));

    case "discount:get":
      return getDiscount(http, requireId(args, "discount"));
    case "discount:list":
      return listDiscountsForStore(http, requireStore(args));
    case "discount:create":
      return createDiscount(http, requireBody(args));
    case "discount:delete":
      await deleteDiscount(http, requireId(args, "discount"));
      return undefined;

    case "discount-redemption:get":
      return getDiscountRedemption(http, requireId(args, "discount-redemption"));
    case "discount-redemption:list":
      return listDiscountRedemptionsForDiscount(http, requireParent(args, "discount"));

    case "license-key:get":
      return getLicenseKey(http, requireId(args, "license-key"));
    case "license-key:list":
      return listLicenseKeysForStore(http, requireStore(args));
    case "license-key:update":
      return updateLicenseKey(http, requireId(args, "license-key"), requireBody(args));

    case "license-key-instance:get":
      return getLicenseKeyInstance(http, requireId(args, "license-key-instance"));
    case "license-key-instance:list":
      return listLicenseKeyInstancesForLicenseKey(http, requireParent(args, "license-key"));

    case "checkout:get":
      return getCheckout(http, requireId(args, "checkout"));
    case "checkout:list":
      return listCheckoutsForStore(http, requireStore(args));
    case "checkout:create":
      return createCheckout(http, requireBody(args));

    case "webhook:get":
      return getWebhook(http, requireId(args, "webhook"));
    case "webhook:list":
      return listWebhooksForStore(http, requireStore(args));
    case "webhook:create":
      return createWebhook(http, requireBody(args));
    case "webhook:update":
      return updateWebhook(http, requireId(args, "webhook"), requireBody(args));
    case "webhook:delete":
      await deleteWebhook(http, requireId(args, "webhook"));
      return undefined;

    case "affiliate:get":
      return getAffiliate(http, requireId(args, "affiliate"));
    case "affiliate:list":
      return listAffiliatesForStore(http, requireStore(args));

    default:
      throw new FreshSqueezyError({
        code: "UNKNOWN_OP",
        message: `Op registered but not wired: ${key}`,
      });
  }
};

const requireId = (args: InvokeOpArgs, label: string): string | number => {
  if (args.id === undefined || args.id === "") {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: `--id is required for this ${label} operation.`,
    });
  }
  return args.id;
};

const requireStore = (args: InvokeOpArgs): string | number => {
  if (args.storeId === undefined || args.storeId === "") {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: "--store-ids (or store id) is required for this list operation.",
    });
  }
  return args.storeId;
};

const requireParent = (args: InvokeOpArgs, label: string): string | number => {
  if (args.parentId === undefined || args.parentId === "") {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: `--parent-id (${label} id) is required for this list operation.`,
    });
  }
  return args.parentId;
};

const requireBody = (args: InvokeOpArgs): unknown => {
  if (args.body === undefined) {
    throw new FreshSqueezyError({
      code: "MISSING_ARG",
      message: "A JSON body is required (--body, --body-file, or stdin).",
    });
  }
  return args.body;
};
