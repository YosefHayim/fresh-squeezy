/**
 * Sandbox fixtures captured against a Lemon Squeezy test-mode store.
 * Keep them deterministic — no timestamps that drift, no counters.
 */

export const userDoc = {
  data: {
    type: "users",
    id: "1",
    attributes: {
      name: "Test Developer",
      email: "dev@example.com",
      has_custom_avatar: false,
    },
  },
  meta: {
    test_mode: true,
  },
};

export const liveUserDoc = {
  data: {
    type: "users",
    id: "2",
    attributes: {
      name: "Live Merchant",
      email: "live@example.com",
      has_custom_avatar: false,
    },
  },
  meta: {
    test_mode: false,
  },
};

export const storesCollection = {
  data: [
    {
      type: "stores",
      id: "42",
      attributes: {
        name: "Fresh Squeezy Test Store",
        slug: "fresh-squeezy-test",
        country: "US",
        currency: "USD",
        plan: "fresh",
      },
    },
  ],
};

export const storeDoc = {
  data: {
    type: "stores",
    id: "42",
    attributes: {
      name: "Fresh Squeezy Test Store",
      slug: "fresh-squeezy-test",
      country: "US",
      currency: "USD",
      plan: "fresh",
    },
  },
};

export const publishedProductDoc = {
  data: {
    type: "products",
    id: "100",
    attributes: {
      name: "Pro Plan",
      slug: "pro-plan",
      status: "published",
      status_formatted: "Published",
      store_id: 42,
      buy_now_url: "https://fresh-squeezy-test.lemonsqueezy.com/buy/pro",
      from_price: 1900,
      to_price: 1900,
    },
  },
};

export const unpublishedProductDoc = {
  data: {
    type: "products",
    id: "101",
    attributes: {
      name: "Draft Plan",
      slug: "draft-plan",
      status: "draft",
      store_id: 42,
      buy_now_url: null,
    },
  },
};

export const productOnWrongStoreDoc = {
  data: {
    type: "products",
    id: "102",
    attributes: {
      name: "Cross-store Plan",
      slug: "cross-store",
      status: "published",
      store_id: 99,
      buy_now_url: "https://other-store.lemonsqueezy.com/buy/x",
    },
  },
};

export const variantsCollectionPublished = {
  data: [
    {
      type: "variants",
      id: "500",
      attributes: {
        product_id: 100,
        name: "Monthly",
        slug: "monthly",
        status: "published",
        is_subscription: true,
        interval: "month",
        interval_count: 1,
      },
    },
  ],
};

export const variantsCollectionEmpty = { data: [] };

export const variantsCollectionAllDraft = {
  data: [
    {
      type: "variants",
      id: "501",
      attributes: {
        product_id: 101,
        name: "Draft",
        slug: "draft",
        status: "draft",
        is_subscription: false,
      },
    },
  ],
};

export const webhooksCollectionComplete = {
  data: [
    {
      type: "webhooks",
      id: "900",
      attributes: {
        store_id: 42,
        url: "https://app.example.com/api/webhooks/lemon-squeezy",
        events: [
          "order_created",
          "order_refunded",
          "subscription_created",
          "subscription_updated",
          "subscription_cancelled",
          "subscription_resumed",
          "subscription_expired",
          "subscription_payment_success",
          "subscription_payment_failed",
          "customer_updated",
        ],
        last_sent_at: null,
      },
    },
  ],
};

export const webhooksCollectionMissingEvents = {
  data: [
    {
      type: "webhooks",
      id: "901",
      attributes: {
        store_id: 42,
        url: "https://app.example.com/api/webhooks/lemon-squeezy",
        events: ["order_created", "subscription_created"],
        last_sent_at: null,
      },
    },
  ],
};

export const webhooksCollectionEmpty = { data: [] };

// --- Discount fixtures ---

export const publishedDiscountDoc = {
  data: {
    type: "discounts",
    id: "600",
    attributes: {
      name: "Summer Sale",
      code: "SUMMER20",
      amount: 20,
      amount_type: "percent" as const,
      is_limited_to_products: false,
      is_limited_redemptions: false,
      max_redemptions: 0,
      starts_at: null,
      expires_at: "2099-12-31T23:59:59Z",
      status: "published" as const,
      duration: "once" as const,
      store_id: 42,
    },
  },
};

export const draftDiscountDoc = {
  data: {
    type: "discounts",
    id: "601",
    attributes: {
      name: "Draft Discount",
      code: "DRAFT10",
      amount: 10,
      amount_type: "percent" as const,
      is_limited_to_products: false,
      is_limited_redemptions: false,
      max_redemptions: 0,
      starts_at: null,
      expires_at: null,
      status: "draft" as const,
      duration: "forever" as const,
      store_id: 42,
    },
  },
};

export const expiredDiscountDoc = {
  data: {
    type: "discounts",
    id: "602",
    attributes: {
      name: "Old Promo",
      code: "OLD50",
      amount: 50,
      amount_type: "percent" as const,
      is_limited_to_products: false,
      is_limited_redemptions: false,
      max_redemptions: 0,
      starts_at: null,
      expires_at: "2020-01-01T00:00:00Z",
      status: "published" as const,
      duration: "once" as const,
      store_id: 42,
    },
  },
};

export const futureDiscountDoc = {
  data: {
    type: "discounts",
    id: "603",
    attributes: {
      name: "Future Promo",
      code: "FUTURE",
      amount: 15,
      amount_type: "fixed" as const,
      is_limited_to_products: false,
      is_limited_redemptions: false,
      max_redemptions: 0,
      starts_at: "2099-06-01T00:00:00Z",
      expires_at: null,
      status: "published" as const,
      duration: "repeating" as const,
      store_id: 42,
    },
  },
};

export const exhaustedDiscountDoc = {
  data: {
    type: "discounts",
    id: "604",
    attributes: {
      name: "Exhausted",
      code: "DONE",
      amount: 5,
      amount_type: "fixed" as const,
      is_limited_to_products: false,
      is_limited_redemptions: true,
      max_redemptions: 0,
      starts_at: null,
      expires_at: null,
      status: "published" as const,
      duration: "once" as const,
      store_id: 42,
    },
  },
};

export const invalidPercentDiscountDoc = {
  data: {
    type: "discounts",
    id: "605",
    attributes: {
      name: "Bad Percent",
      code: "BAD150",
      amount: 150,
      amount_type: "percent" as const,
      is_limited_to_products: false,
      is_limited_redemptions: false,
      max_redemptions: 0,
      starts_at: null,
      expires_at: null,
      status: "published" as const,
      duration: "once" as const,
      store_id: 42,
    },
  },
};

export const zeroAmountDiscountDoc = {
  data: {
    type: "discounts",
    id: "606",
    attributes: {
      name: "Zero Discount",
      code: "ZERO",
      amount: 0,
      amount_type: "percent" as const,
      is_limited_to_products: false,
      is_limited_redemptions: false,
      max_redemptions: 0,
      starts_at: null,
      expires_at: null,
      status: "published" as const,
      duration: "once" as const,
      store_id: 42,
    },
  },
};

export const wrongStoreDiscountDoc = {
  data: {
    type: "discounts",
    id: "607",
    attributes: {
      name: "Other Store",
      code: "OTHER",
      amount: 10,
      amount_type: "percent" as const,
      is_limited_to_products: false,
      is_limited_redemptions: false,
      max_redemptions: 0,
      starts_at: null,
      expires_at: "2099-12-31T23:59:59Z",
      status: "published" as const,
      duration: "once" as const,
      store_id: 99,
    },
  },
};

// --- License key fixtures ---

export const activeLicenseKeyDoc = {
  data: {
    type: "license-keys",
    id: "700",
    attributes: {
      key_short: "XXXX-XXXX",
      status: "active" as const,
      expires_at: "2099-12-31T23:59:59Z",
      activation_limit: 5,
      instances_count: 2,
      disabled: false,
      store_id: 42,
    },
  },
};

export const disabledLicenseKeyDoc = {
  data: {
    type: "license-keys",
    id: "701",
    attributes: {
      key_short: "DDDD-DDDD",
      status: "disabled" as const,
      expires_at: null,
      activation_limit: null,
      instances_count: 0,
      disabled: true,
      store_id: 42,
    },
  },
};

export const expiredLicenseKeyDoc = {
  data: {
    type: "license-keys",
    id: "702",
    attributes: {
      key_short: "EEEE-EEEE",
      status: "expired" as const,
      expires_at: "2020-01-01T00:00:00Z",
      activation_limit: 3,
      instances_count: 1,
      disabled: false,
      store_id: 42,
    },
  },
};

export const atLimitLicenseKeyDoc = {
  data: {
    type: "license-keys",
    id: "703",
    attributes: {
      key_short: "LLLL-LLLL",
      status: "active" as const,
      expires_at: null,
      activation_limit: 3,
      instances_count: 3,
      disabled: false,
      store_id: 42,
    },
  },
};

export const wrongStoreLicenseKeyDoc = {
  data: {
    type: "license-keys",
    id: "704",
    attributes: {
      key_short: "WWWW-WWWW",
      status: "active" as const,
      expires_at: null,
      activation_limit: null,
      instances_count: 0,
      disabled: false,
      store_id: 99,
    },
  },
};

// --- Subscription variant fixtures ---

export const subscriptionVariantDoc = {
  data: {
    type: "variants",
    id: "800",
    attributes: {
      product_id: 100,
      name: "Pro Monthly",
      slug: "pro-monthly",
      status: "published",
      is_subscription: true,
      interval: "month",
      interval_count: 1,
      has_free_trial: false,
      trial_interval: null,
      trial_interval_count: null,
      price: 1900,
    },
  },
};

export const nonSubscriptionVariantDoc = {
  data: {
    type: "variants",
    id: "801",
    attributes: {
      product_id: 100,
      name: "One-time Purchase",
      slug: "one-time",
      status: "published",
      is_subscription: false,
      interval: null,
      interval_count: null,
      has_free_trial: false,
      trial_interval: null,
      trial_interval_count: null,
      price: 2900,
    },
  },
};

export const invalidIntervalVariantDoc = {
  data: {
    type: "variants",
    id: "802",
    attributes: {
      product_id: 100,
      name: "Bad Interval",
      slug: "bad-interval",
      status: "published",
      is_subscription: true,
      interval: null,
      interval_count: 0,
      has_free_trial: false,
      trial_interval: null,
      trial_interval_count: null,
      price: 1900,
    },
  },
};

export const freePriceSubscriptionVariantDoc = {
  data: {
    type: "variants",
    id: "803",
    attributes: {
      product_id: 100,
      name: "Free Plan",
      slug: "free-plan",
      status: "published",
      is_subscription: true,
      interval: "month",
      interval_count: 1,
      has_free_trial: false,
      trial_interval: null,
      trial_interval_count: null,
      price: 0,
    },
  },
};

export const trialInconsistentVariantDoc = {
  data: {
    type: "variants",
    id: "804",
    attributes: {
      product_id: 100,
      name: "Bad Trial",
      slug: "bad-trial",
      status: "published",
      is_subscription: true,
      interval: "month",
      interval_count: 1,
      has_free_trial: true,
      trial_interval: null,
      trial_interval_count: 0,
      price: 1900,
    },
  },
};

export const draftSubscriptionVariantDoc = {
  data: {
    type: "variants",
    id: "805",
    attributes: {
      product_id: 100,
      name: "Draft Plan",
      slug: "draft-plan",
      status: "draft",
      is_subscription: true,
      interval: "month",
      interval_count: 1,
      has_free_trial: false,
      trial_interval: null,
      trial_interval_count: null,
      price: 1900,
    },
  },
};

export const wrongStoreSubscriptionVariantDoc = {
  data: {
    type: "variants",
    id: "806",
    attributes: {
      product_id: 102,
      name: "Wrong Store Plan",
      slug: "wrong-store",
      status: "published",
      is_subscription: true,
      interval: "month",
      interval_count: 1,
      has_free_trial: false,
      trial_interval: null,
      trial_interval_count: null,
      price: 1900,
    },
  },
};

export const unauthorizedError = {
  errors: [
    {
      status: "401",
      code: "unauthenticated",
      title: "Unauthenticated",
      detail: "Invalid API key",
    },
  ],
};

export const notFoundError = {
  errors: [
    {
      status: "404",
      code: "not_found",
      title: "Not Found",
      detail: "The requested resource could not be found.",
    },
  ],
};
