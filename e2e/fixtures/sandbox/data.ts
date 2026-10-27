export const USER_DOC = {
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

export const LIVE_USER_DOC = {
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

export const STORES_COLLECTION = {
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

export const STORE_DOC = {
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

export const PUBLISHED_PRODUCT_DOC = {
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

export const UNPUBLISHED_PRODUCT_DOC = {
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

export const PRODUCT_ON_WRONG_STORE_DOC = {
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

export const VARIANTS_COLLECTION_PUBLISHED = {
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

export const VARIANTS_COLLECTION_EMPTY = { data: [] };

export const VARIANTS_COLLECTION_ALL_DRAFT = {
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

export const WEBHOOKS_COLLECTION_COMPLETE = {
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

export const WEBHOOKS_COLLECTION_MISSING_EVENTS = {
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

export const WEBHOOKS_COLLECTION_EMPTY = { data: [] };

// --- Discount fixtures ---

type DiscountAttributes = {
	name: string;
	code: string;
	amount: number;
	amount_type: "percent" | "fixed";
	is_limited_to_products: boolean;
	is_limited_redemptions: boolean;
	max_redemptions: number;
	starts_at: string | null;
	expires_at: string | null;
	status: "published" | "draft";
	duration: "once" | "forever" | "repeating";
	store_id: number;
};

const discountDocOf = (id: string, overrides: Partial<DiscountAttributes>) => ({
	data: {
		type: "discounts",
		id,
		attributes: {
			name: "Summer Sale",
			code: "SUMMER20",
			amount: 20,
			amount_type: "percent",
			is_limited_to_products: false,
			is_limited_redemptions: false,
			max_redemptions: 0,
			starts_at: null,
			expires_at: null,
			status: "published",
			duration: "once",
			store_id: 42,
			...overrides,
		} as DiscountAttributes,
	},
});

export const publishedDiscountDoc = discountDocOf("600", {
	expires_at: "2099-12-31T23:59:59Z",
});

export const draftDiscountDoc = discountDocOf("601", {
	name: "Draft Discount",
	code: "DRAFT10",
	amount: 10,
	status: "draft",
	duration: "forever",
});

export const expiredDiscountDoc = discountDocOf("602", {
	name: "Old Promo",
	code: "OLD50",
	amount: 50,
	expires_at: "2020-01-01T00:00:00Z",
});

export const futureDiscountDoc = discountDocOf("603", {
	name: "Future Promo",
	code: "FUTURE",
	amount: 15,
	amount_type: "fixed",
	starts_at: "2099-06-01T00:00:00Z",
	duration: "repeating",
});

export const exhaustedDiscountDoc = discountDocOf("604", {
	name: "Exhausted",
	code: "DONE",
	amount: 5,
	amount_type: "fixed",
	is_limited_redemptions: true,
});

export const invalidPercentDiscountDoc = discountDocOf("605", {
	name: "Bad Percent",
	code: "BAD150",
	amount: 150,
});

export const zeroAmountDiscountDoc = discountDocOf("606", {
	name: "Zero Discount",
	code: "ZERO",
	amount: 0,
});

export const wrongStoreDiscountDoc = discountDocOf("607", {
	name: "Other Store",
	code: "OTHER",
	amount: 10,
	expires_at: "2099-12-31T23:59:59Z",
	store_id: 99,
});

// --- License key fixtures ---

type LicenseKeyAttributes = {
	key_short: string;
	status: "active" | "disabled" | "expired";
	expires_at: string | null;
	activation_limit: number | null;
	instances_count: number;
	disabled: boolean;
	store_id: number;
};

const licenseKeyDocOf = (
	id: string,
	overrides: Partial<LicenseKeyAttributes>,
) => ({
	data: {
		type: "license-keys",
		id,
		attributes: {
			key_short: "XXXX-XXXX",
			status: "active",
			expires_at: null,
			activation_limit: null,
			instances_count: 0,
			disabled: false,
			store_id: 42,
			...overrides,
		} as LicenseKeyAttributes,
	},
});

export const activeLicenseKeyDoc = licenseKeyDocOf("700", {
	expires_at: "2099-12-31T23:59:59Z",
	activation_limit: 5,
	instances_count: 2,
});

export const disabledLicenseKeyDoc = licenseKeyDocOf("701", {
	key_short: "DDDD-DDDD",
	status: "disabled",
	disabled: true,
});

export const expiredLicenseKeyDoc = licenseKeyDocOf("702", {
	key_short: "EEEE-EEEE",
	status: "expired",
	expires_at: "2020-01-01T00:00:00Z",
	activation_limit: 3,
	instances_count: 1,
});

export const atLimitLicenseKeyDoc = licenseKeyDocOf("703", {
	key_short: "LLLL-LLLL",
	activation_limit: 3,
	instances_count: 3,
});

export const wrongStoreLicenseKeyDoc = licenseKeyDocOf("704", {
	key_short: "WWWW-WWWW",
	store_id: 99,
});

// --- Subscription variant fixtures ---

const variantDocOf = (id: string, overrides: Record<string, unknown>) => ({
	data: {
		type: "variants",
		id,
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
			...overrides,
		},
	},
});

export const subscriptionVariantDoc = variantDocOf("800", {});

export const nonSubscriptionVariantDoc = variantDocOf("801", {
	name: "One-time Purchase",
	slug: "one-time",
	is_subscription: false,
	interval: null,
	interval_count: null,
	price: 2900,
});

export const invalidIntervalVariantDoc = variantDocOf("802", {
	name: "Bad Interval",
	slug: "bad-interval",
	interval: null,
	interval_count: 0,
});

export const missingIntervalCountVariantDoc = variantDocOf("810", {
	name: "No Interval Count",
	slug: "no-interval-count",
	interval_count: undefined,
});

export const freePriceSubscriptionVariantDoc = variantDocOf("803", {
	name: "Free Plan",
	slug: "free-plan",
	price: 0,
});

export const trialInconsistentVariantDoc = variantDocOf("804", {
	name: "Bad Trial",
	slug: "bad-trial",
	has_free_trial: true,
	trial_interval_count: 0,
});

export const draftSubscriptionVariantDoc = variantDocOf("805", {
	name: "Draft Plan",
	slug: "draft-plan",
	status: "draft",
});

export const wrongStoreSubscriptionVariantDoc = variantDocOf("806", {
	product_id: 102,
	name: "Wrong Store Plan",
	slug: "wrong-store",
});

export const UNAUTHORIZED_ERROR = {
	errors: [
		{
			status: "401",
			code: "unauthenticated",
			title: "Unauthenticated",
			detail: "Invalid API key",
		},
	],
};

export const NOT_FOUND_ERROR = {
	errors: [
		{
			status: "404",
			code: "not_found",
			title: "Not Found",
			detail: "The requested resource could not be found.",
		},
	],
};
