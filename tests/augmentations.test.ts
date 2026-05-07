import { describe, expect, it } from "vitest";
import type {
  LatestOrderFields,
  LatestPriceFields,
  LatestSubscriptionFields,
  LatestVariantFields,
  WithLatestLemonSqueezyFields,
} from "../src/augmentations.js";

/**
 * The augmentation module is type-level. There's nothing to call, so we
 * assert the intersections behave by constructing values that satisfy
 * both the base type and the latest fields, and verifying TypeScript
 * accepts them. A mistake in the helper would surface as a typecheck
 * failure when the suite is run.
 */
describe("WithLatestLemonSqueezyFields", () => {
  it("intersects a base subscription type with payment_processor and tax_inclusive", () => {
    interface BaseSubscription {
      store_id: number;
      status: string;
    }
    type Augmented = WithLatestLemonSqueezyFields<BaseSubscription, "subscription">;

    const sub: Augmented = {
      store_id: 1,
      status: "active",
      payment_processor: "stripe",
      tax_inclusive: true,
      urls: { update_customer_portal: "https://x" },
    };

    expect(sub.payment_processor).toBe("stripe");
    expect(sub.urls?.update_customer_portal).toBe("https://x");
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
    const variant: LatestVariantFields = { links: { checkout: "https://x" } };
    const price: LatestPriceFields = { setup_fee_enabled: true, setup_fee: 100 };

    expect(sub.payment_processor).toBe("paypal");
    expect(order.tax_inclusive).toBe(true);
    expect(variant.links?.checkout).toBe("https://x");
    expect(price.setup_fee).toBe(100);
  });
});
