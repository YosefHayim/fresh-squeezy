export const RECOMMENDED_WEBHOOK_EVENTS = [
	"order_created",
	"order_refunded",
	"subscription_created",
	"subscription_updated",
	"subscription_cancelled",
	"subscription_resumed",
	"subscription_expired",
	"subscription_payment_success",
	"subscription_payment_failed",
] as const;

export const OPTIONAL_WEBHOOK_EVENTS = [
	"customer_updated",
	"affiliate_activated",
	"license_key_created",
	"license_key_updated",
] as const;

export const ACKNOWLEDGED_CHANGELOG_ENTRIES = [
	{
		date: "2026-07-29",
		summary: "Added referral_amount to Order and Subscription invoice objects.",
		handledBy: "Generated API types (src/shared/lemon-squeezy-api-types.ts).",
	},
	{
		date: "2026-07-22",
		summary:
			"Added affiliate_id and an affiliate relationship to Order and Subscription invoice objects. Added an affiliates relationship to Customer objects.",
		handledBy: "Generated API types (src/shared/lemon-squeezy-api-types.ts).",
	},
	{
		date: "2026-02-25",
		summary: "Added customer_updated webhook event.",
		handledBy: "OPTIONAL_WEBHOOK_EVENTS",
	},
	{
		date: "2025-06-11",
		summary: "Added payment_processor attribute to Subscription objects.",
		handledBy:
			"Surfaced as SubscriptionAttributes.payment_processor in src/shared/attributes.ts.",
	},
	{
		date: "2025-01-21",
		summary: "Added Affiliates endpoints and affiliate_activated webhook.",
		handledBy:
			"client.affiliates (get, list) plus affiliate_activated in OPTIONAL_WEBHOOK_EVENTS.",
	},
	{
		date: "2024-12-06",
		summary: "Added quantity parameter to OrderItem objects.",
		handledBy: "OrderItemAttributes.quantity (src/shared/attributes.ts).",
	},
	{
		date: "2024-09-10",
		summary: "Added fraudulent Order status.",
		handledBy:
			"OrderAttributes.status union includes 'fraudulent' (src/shared/attributes.ts).",
	},
	{
		date: "2024-09-04",
		summary:
			"Added Issue an Order refund and Issue a Subscription Invoice refund endpoints.",
		handledBy:
			"client.orders.refund and client.subscriptionInvoices.refund. Refund-amount fields surfaced on OrderAttributes.",
	},
	{
		date: "2024-08-07",
		summary:
			"Added refunded_amount, refunded_amount_usd, refunded_amount_formatted to Order and Subscription invoice objects.",
		handledBy:
			"OrderAttributes.refunded_amount*, SubscriptionInvoiceAttributes.refunded_amount*.",
	},
	{
		date: "2024-06-09",
		summary: "Added links property to Variant objects.",
		handledBy: "VariantAttributes.links (src/shared/attributes.ts).",
	},
	{
		date: "2024-05-20",
		summary: "Added Generate order invoice endpoint.",
		handledBy: "client.orders.generateInvoice.",
	},
	{
		date: "2024-04-09",
		summary: "License Key expires_at is now mutable via the update endpoint.",
		handledBy:
			"Type unchanged (LicenseKeyAttributes.expires_at already nullable string). Mutation via client.licenseKeys.update.",
	},
	{
		date: "2024-03-28",
		summary:
			"Subscription trial_ends_at is now mutable via the update endpoint.",
		handledBy:
			"SubscriptionAttributes.trial_ends_at plus CheckoutOptions.skip_trial. Mutation via client.subscriptions.update.",
	},
	{
		date: "2024-02-20",
		summary: "Added urls.update_customer_portal to Subscription objects.",
		handledBy:
			"SubscriptionUrls.update_customer_portal (src/shared/attributes.ts).",
	},
	{
		date: "2024-02-12",
		summary:
			"Added Generate subscription invoice endpoint and invoice_immediately / disable_prorations parameters.",
		handledBy:
			"SubscriptionItemUpdateAttributes.invoice_immediately / disable_prorations; invoice endpoint via client.subscriptionInvoices.generateInvoice.",
	},
	{
		date: "2024-02-05",
		summary:
			"Added tax_inclusive parameter to Order objects and Subscription invoice objects.",
		handledBy:
			"OrderAttributes.tax_inclusive, SubscriptionInvoiceAttributes.tax_inclusive.",
	},
	{
		date: "2024-01-21",
		summary:
			"Added setup_fee_enabled / setup_fee to Price objects; setup_fee* to Subscription invoice.",
		handledBy: "PriceAttributes.setup_fee*, OrderAttributes.setup_fee*.",
	},
	{
		date: "2024-01-15",
		summary: "Added unit_price_decimal to Price objects.",
		handledBy: "PriceAttributes.unit_price_decimal.",
	},
	{
		date: "2024-01-05",
		summary: "Added test_mode flag to /v1/users/me meta.",
		handledBy:
			"Read in validateConnection to emit MODE_MISMATCH when the key's true mode differs from the caller's declared mode.",
	},
	{
		date: "2023-09-19",
		summary: "Added customer_portal URLs to Subscription and Customer objects.",
		handledBy:
			"SubscriptionUrls.customer_portal and CustomerUrls.customer_portal.",
	},
	{
		date: "2023-08-23",
		summary:
			"Added checkout_data.variant_quantities, subscription items, prices, and usage-based billing.",
		handledBy:
			"CheckoutData.variant_quantities, SubscriptionItemAttributes, UsageRecordAttributes, PriceAttributes.",
	},
	{
		date: "2023-08-14",
		summary:
			"Added customer_id, user_name, user_email to Subscription invoice objects.",
		handledBy: "SubscriptionInvoiceAttributes customer fields.",
	},
	{
		date: "2023-03-30",
		summary: "Added receipt URL to Order objects.",
		handledBy: "OrderUrls.receipt.",
	},
] as const;

export type RecommendedEvent = (typeof RECOMMENDED_WEBHOOK_EVENTS)[number];
export type OptionalEvent = (typeof OPTIONAL_WEBHOOK_EVENTS)[number];
