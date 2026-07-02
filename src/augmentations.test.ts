import { describe, expect, it } from "vitest";
import type {
  GeneratedLemonSqueezyFieldMap,
  LatestCheckoutFields,
  LatestFieldsFor,
  LatestOrderFields,
  LatestOrderItemFields,
  LatestPriceFields,
  LatestSubscriptionFields,
  LatestSubscriptionInvoiceFields,
  LatestSubscriptionItemUpdateFields,
  LatestVariantFields,
  WithLatestLemonSqueezyFields,
} from "./augmentations.js";

/**
 * The augmentation module is type-level. There's nothing to call, so we
 * assert the intersections behave by constructing values that satisfy
 * both the base type and the latest fields, and verifying TypeScript
 * accepts them. A mistake in the helper would surface as a typecheck
 * failure when the suite is run.
 */
describe("WithLatestLemonSqueezyFields", () => {
  it("intersects a base subscription type with payment_processor and portal URLs", () => {
    interface BaseSubscription {
      store_id: number;
      status: string;
    }
    type Augmented = WithLatestLemonSqueezyFields<BaseSubscription, "subscription">;

    const sub: Augmented = {
      store_id: 1,
      status: "active",
      payment_processor: "stripe",
      urls: { update_customer_portal: "https://x" },
    };

    expect(sub.payment_processor).toBe("stripe");
    expect(sub.urls?.update_customer_portal).toBe("https://x");
  });

  it("intersects subscription invoice and checkout changelog fields", () => {
    interface BaseInvoice {
      subscription_id: number;
      total: number;
    }
    interface BaseCheckout {
      variant_id: number;
    }

    type Invoice = WithLatestLemonSqueezyFields<BaseInvoice, "subscriptionInvoice">;
    type Checkout = WithLatestLemonSqueezyFields<BaseCheckout, "checkout">;

    const invoice: Invoice = {
      subscription_id: 55,
      total: 1900,
      tax_inclusive: true,
      refunded_amount_formatted: "$5.00",
    };
    const checkout: Checkout = {
      variant_id: 100,
      checkout_options: { skip_trial: true, button_color: "#111111" },
      checkout_data: { variant_quantities: [{ variant_id: 100, quantity: 2 }] },
    };

    expect(invoice.tax_inclusive).toBe(true);
    expect(checkout.checkout_options?.skip_trial).toBe(true);
    expect(checkout.checkout_data?.variant_quantities?.[0]?.quantity).toBe(2);
  });

  it("intersects a base order type with refund-amount fields", () => {
    interface BaseOrder {
      store_id: number;
      total: number;
    }
    type Augmented = WithLatestLemonSqueezyFields<BaseOrder, "order">;

    const order: Augmented = {
      store_id: 1,
      total: 1000,
      status: "fraudulent",
      refunded_amount: 500,
      tax_inclusive: false,
    };

    expect(order.status).toBe("fraudulent");
    expect(order.refunded_amount).toBe(500);
  });

  it("exposes the field-by-field interfaces independently", () => {
    const sub: LatestSubscriptionFields = { payment_processor: "paypal" };
    const order: LatestOrderFields = { tax_inclusive: true };
    const orderItem: LatestOrderItemFields = { quantity: 3 };
    const invoice: LatestSubscriptionInvoiceFields = { refunded_amount: 500 };
    const subscriptionItemUpdate: LatestSubscriptionItemUpdateFields = {
      invoice_immediately: true,
      disable_prorations: true,
    };
    const variant: LatestVariantFields = { links: [{ title: "Checkout", url: "https://x" }] };
    const price: LatestPriceFields = { setup_fee_enabled: true, setup_fee: 100 };
    const checkout: LatestCheckoutFields = {
      checkout_options: { skip_trial: true },
      checkout_data: { variant_quantities: [{ variant_id: 1, quantity: 2 }] },
    };

    expect(sub.payment_processor).toBe("paypal");
    expect(order.tax_inclusive).toBe(true);
    expect(orderItem.quantity).toBe(3);
    expect(invoice.refunded_amount).toBe(500);
    expect(subscriptionItemUpdate.disable_prorations).toBe(true);
    expect(Array.isArray(variant.links)).toBe(true);
    expect(price.setup_fee).toBe(100);
    expect(checkout.checkout_options?.skip_trial).toBe(true);
  });

  it("uses generated docs fields for resources without hand-written latest fields", () => {
    interface BaseCustomer {
      id: string;
    }

    type Customer = WithLatestLemonSqueezyFields<BaseCustomer, "customer">;
    type Store = LatestFieldsFor<"store">;

    const customer: Customer = {
      id: "1",
      email: "buyer@example.test",
      urls: { customer_portal: "https://example.test/portal" },
    };
    const store: Store = { thirty_day_revenue: 5000 };
    const generatedMap: GeneratedLemonSqueezyFieldMap = {
      user: {},
      store,
      customer,
      product: {},
      variant: {},
      price: {},
      file: {},
      order: {},
      orderItem: {},
      subscription: {},
      subscriptionInvoice: {},
      subscriptionItem: {},
      usageRecord: {},
      discount: {},
      discountRedemption: {},
      licenseKey: {},
      licenseKeyInstance: {},
      checkout: {},
      webhook: {},
      affiliate: {},
    };

    expect(customer.urls?.customer_portal).toBe("https://example.test/portal");
    expect(generatedMap.store.thirty_day_revenue).toBe(5000);
  });
});
