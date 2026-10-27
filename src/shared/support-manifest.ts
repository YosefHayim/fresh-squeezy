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
