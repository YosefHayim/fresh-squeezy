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
